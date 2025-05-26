package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path"
	"strconv"
	"strings"

	"dagger.io/dagger"
	"github.com/urfave/cli/v3"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	if err := NewApp().Run(ctx, os.Args); err != nil {
		cancel()
		fmt.Println(err)
		os.Exit(1)
	}
}

func NewApp() *cli.Command {
	return &cli.Command{
		Name:  "e2e",
		Usage: "Run the E2E tests for Grafana",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:      "suite",
				Usage:     "E2E test suite path (e.g. e2e/various-suite)",
				Validator: mustBeDir("suite"),
				TakesFile: true,
				Required:  true,
			},

			&cli.StringFlag{
				Name:      "grafana-dir",
				Usage:     "Path to the grafana/grafana clone directory",
				Value:     ".",
				Validator: mustBeDir("grafana-dir"),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:      "package",
				Usage:     "Path to the grafana tar.gz package",
				Value:     "grafana.tar.gz",
				Validator: mustBeFile("package", false),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:      "license",
				Usage:     "Path to the Grafana Enterprise license file (optional)",
				Validator: mustBeFile("license", true),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:  "flags",
				Usage: "Flags to pass through to the e2e runner",
			},
			&cli.BoolFlag{
				Name:  "image-renderer",
				Usage: "Install the image renderer plugin",
				Value: false,
			},
			&cli.StringSliceFlag{
				Name:  "host-ports",
				Usage: "Ports to forward from the host to the Grafana service under the 'host' hostname. Format is: [host-port:]service-port[/protocol], e.g. 3306:3306/tcp",
				Validator: func(s []string) error {
					for _, portForward := range s {
						if _, err := parsePortForward(portForward); err != nil {
							return cli.Exit("invalid port forward: "+portForward+", "+err.Error(), 1)
						}
					}
					return nil
				},
			},
		},
		Action: run,
	}
}

func run(ctx context.Context, cmd *cli.Command) error {
	grafanaDir := cmd.String("grafana-dir")
	suite := cmd.String("suite")
	targzPath := cmd.String("package")
	licensePath := cmd.String("license")
	imageRenderer := cmd.Bool("image-renderer")
	runnerFlags := cmd.String("flags")
	hostPortsRaw := cmd.StringSlice("host-ports")
	hostPorts := make([]dagger.PortForward, 0, len(hostPortsRaw))
	for _, portForward := range hostPortsRaw {
		pf, err := parsePortForward(portForward)
		if err != nil {
			return cli.Exit("invalid port forward: "+portForward+", "+err.Error(), 1)
		}
		hostPorts = append(hostPorts, pf)
	}

	d, err := dagger.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to connect to Dagger: %w", err)
	}

	yarnCache := d.CacheVolume("yarn")

	log.Println("grafana dir:", grafanaDir)
	log.Println("targz:", targzPath)
	log.Println("license path:", licensePath)

	grafana := d.Host().Directory(".", dagger.HostDirectoryOpts{
		Exclude: []string{"node_modules", "*.tar.gz"},
	})
	targz := d.Host().File(targzPath)

	var license *dagger.File
	if licensePath != "" {
		license = d.Host().File(licensePath)
	}

	svc, err := GrafanaService(ctx, d, GrafanaServiceOpts{
		GrafanaDir:           grafana,
		GrafanaTarGz:         targz,
		YarnCache:            yarnCache,
		License:              license,
		InstallImageRenderer: imageRenderer,
		HostPorts:            hostPorts,
	})
	if err != nil {
		return fmt.Errorf("failed to create Grafana service: %w", err)
	}

	videosDir := path.Join("/src", suite, "videos")
	// *spec.ts.mp4
	c := RunSuite(d, svc, grafana, yarnCache, suite, runnerFlags)
	c, err = c.Sync(ctx)
	if err != nil {
		return fmt.Errorf("failed to run e2e test suite: %w", err)
	}

	code, err := c.ExitCode(ctx)
	if err != nil {
		return fmt.Errorf("failed to get exit code of e2e test suite: %w", err)
	}

	log.Println("exit code:", code)

	// No sync error; export the videos dir
	if _, err := c.Directory(videosDir).Export(ctx, "videos"); err != nil {
		return fmt.Errorf("failed to export videos directory: %w", err)
	}

	if code != 0 {
		return fmt.Errorf("e2e tests failed with exit code %d", code)
	}

	log.Println("e2e tests completed successfully")
	return nil
}

func mustBeFile(arg string, emptyOk bool) func(string) error {
	return func(s string) error {
		if s == "" {
			if emptyOk {
				return nil
			}
			return cli.Exit(arg+" cannot be empty", 1)
		}
		stat, err := os.Stat(s)
		if err != nil {
			return cli.Exit(arg+" does not exist or cannot be read: "+s, 1)
		}
		if stat.IsDir() {
			return cli.Exit(arg+" must be a file, not a directory: "+s, 1)
		}
		return nil
	}
}

func mustBeDir(arg string) func(string) error {
	return func(s string) error {
		if s == "" {
			return cli.Exit(arg+" cannot be empty", 1)
		}
		stat, err := os.Stat(s)
		if err != nil {
			return cli.Exit(arg+" does not exist or cannot be read: "+s, 1)
		}
		if !stat.IsDir() {
			return cli.Exit(arg+" must be a directory: "+s, 1)
		}
		return nil
	}
}

func parsePortForward(s string) (dagger.PortForward, error) {
	var pf dagger.PortForward
	if s == "" {
		return pf, errors.New("port forward string cannot be empty")
	}

	parts := strings.SplitN(s, ":", 2)
	if len(parts) == 2 {
		port, err := strconv.Atoi(parts[0])
		if err != nil {
			return pf, errors.New("invalid host port: " + parts[0])
		}
		if port < 1 || port > 65535 {
			return pf, errors.New("service port must be between 1 and 65535: " + parts[0])
		}
		pf.Backend = port
	}

	parts = strings.SplitN(parts[1], "/", 2)
	port, err := strconv.Atoi(parts[0])
	if err != nil {
		return pf, errors.New("invalid service port: " + parts[0])
	}
	if port < 1 || port > 65535 {
		return pf, errors.New("service port must be between 1 and 65535: " + parts[0])
	}
	pf.Frontend = port
	if pf.Backend == 0 {
		pf.Backend = pf.Frontend
	}

	if len(parts) == 2 {
		switch strings.ToLower(parts[1]) {
		case "tcp":
			pf.Protocol = dagger.NetworkProtocolTcp
		case "udp":
			pf.Protocol = dagger.NetworkProtocolUdp
		default:
			return pf, errors.New("invalid protocol: " + parts[1] + ", must be 'tcp' or 'udp'")
		}
	} else {
		pf.Protocol = dagger.NetworkProtocolTcp
	}

	return pf, nil
}
