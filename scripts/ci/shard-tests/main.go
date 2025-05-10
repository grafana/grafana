package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/lmittmann/tint"
	"github.com/urfave/cli/v3"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	cmd := Cmd()
	cmd.Flags = append(cmd.Flags, &cli.BoolFlag{
		Name:    "verbose",
		Aliases: []string{"v"},
		Usage:   "Enable debug level logging.",
		Value:   false,
	})
	cmd.Before = func(ctx context.Context, c *cli.Command) (context.Context, error) {
		level := slog.LevelInfo
		if c.Bool("verbose") {
			level = slog.LevelDebug
		}

		_, runningInCI := os.LookupEnv("CI")
		slog.SetDefault(slog.New(tint.NewHandler(os.Stderr, &tint.Options{
			Level:      level,
			TimeFormat: time.RFC3339,
			NoColor:    runningInCI,
			AddSource:  true,
		})))
		return ctx, nil
	}
	if err := cmd.Run(ctx, os.Args); err != nil {
		slog.Error("Error running command", "error", err)
		os.Exit(1)
	}
}

func Cmd() *cli.Command {
	return &cli.Command{
		Name:      "shard-tests",
		Usage:     "Shard Go tests across multiple directories.",
		ArgsUsage: "DIRECTORY...",
		Arguments: cli.AnyArguments,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "shard",
				Usage:    "The shard to run. Format is N/M where N is the shard number and M is the total number of shards. For example, 1/4 means run the first shard out of 4.",
				Required: true,
				Validator: func(s string) error {
					if _, _, err := parseShard(s); err != nil {
						return cli.Exit(err, 1)
					}
					return nil
				},
			},
			&cli.StringSliceFlag{
				Name:  "test-names-contain",
				Usage: "Only include packages that have tests containing any of the specified strings. Can be specified multiple times.",
			},
			&cli.StringSliceFlag{
				Name:  "test-names-start-with",
				Usage: "Only include packages that have tests starting with any of the specified strings. Can be specified multiple times.",
			},
		},
		Action: run,
	}
}

func run(ctx context.Context, c *cli.Command) error {
	directories := c.Args().Slice()
	if len(directories) == 0 || slices.Contains(directories, "-") {
		stdin, err := readStdIn()
		if err != nil {
			return cli.Exit(fmt.Errorf("failed to read from stdin: %w", err), 1)
		}
		directories = append(directories, stdin...)
	}
	if len(directories) == 0 {
		return cli.Exit("no directories specified", 1)
	}

	testNamesContain := c.StringSlice("test-names-contain")
	testNamesStartWith := c.StringSlice("test-names-start-with")
	shard, shardsTotal, err := parseShard(c.String("shard"))
	if err != nil {
		return err
	}

	pkgs, err := findPkgs(directories, fileSearchParams{
		testNamesContain:   testNamesContain,
		testNamesStartWith: testNamesStartWith,
	})
	if err != nil {
		return cli.Exit(fmt.Errorf("failed to find packages: %w", err), 1)
	}

	shards := ShardPackages(pkgs, shardsTotal)
	ours := shards[shard-1]
	slog.Info("shard selected", "shard", shard, "packages", len(ours), "ratio", float64(len(ours))/float64(len(pkgs)), "ideal-ratio", 1.0/float64(shardsTotal))
	for _, pkg := range ours {
		fmt.Println(pkg)
	}

	return nil
}

func findPkgs(dirs []string, params fileSearchParams) (map[string]int, error) {
	packages := make(map[string]int, len(dirs))

	for _, dir := range dirs {
		if dir == "" {
			continue
		}

		testFiles, err := filepath.Glob(filepath.Join(dir, "*_test.go"))
		if err != nil {
			return nil, fmt.Errorf("failed to glob '%s': %w", dir, err)
		}
		slog.Debug("globbed test files", "dir", dir, "count", len(testFiles))
		if len(testFiles) == 0 {
			continue
		}

		var count int
		for _, testFile := range testFiles {
			c, err := params.CountFileMatches(testFile)
			if err != nil {
				return nil, fmt.Errorf("failed to count matches in '%s': %w", testFile, err)
			}

			count += c
		}
		slog.Debug("found tests in package", "dir", dir, "count", count)

		if count != 0 {
			packages[dir] = count
		}
	}

	return packages, nil
}

func parseShard(shard string) (int, int, error) {
	var n, m int
	_, err := fmt.Sscanf(shard, "%d/%d", &n, &m)
	if err != nil {
		return 0, 0, errors.New("invalid shard format, expected N/M")
	}
	if n <= 0 || m <= 0 {
		return 0, 0, errors.New("shard numbers must be greater than 0")
	}
	if n > m {
		return 0, 0, errors.New("shard number cannot be greater than total number of shards")
	}
	return n, m, nil
}

func readStdIn() ([]string, error) {
	var lines []string

	reader := bufio.NewReader(os.Stdin)
	for {
		line, isPrefix, err := reader.ReadLine()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		for isPrefix {
			var add []byte
			add, isPrefix, err = reader.ReadLine()
			if err != nil {
				return nil, err
			}
			line = append(line, add...)
		}

		l := string(line)
		l = strings.TrimSpace(l)
		if l != "" {
			lines = append(lines, l)
		}
	}

	return lines, nil
}
