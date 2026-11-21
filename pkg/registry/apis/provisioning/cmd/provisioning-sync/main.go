// Command provisioning-sync runs the provisioning pull (sync) job from the command line, for
// development and testing against git, GitHub and local repositories.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	commandPlan = "plan"
	commandPull = "pull"

	repoTokenEnv    = "PROVISIONING_REPO_TOKEN"
	grafanaTokenEnv = "GRAFANA_TOKEN"
)

const usage = `provisioning-sync runs the provisioning pull job from the command line.

Usage:
  provisioning-sync plan [flags]   print what a pull would change, without writing anything
  provisioning-sync pull [flags]   run the pull job against a Repository in a running Grafana

The repository is read from Grafana with --repo, or described with --type and its settings.
plan with --type needs no Grafana and compares against an empty instance.

The repository token comes from --token or $PROVISIONING_REPO_TOKEN and is used instead of
the token Grafana stores, so no secrets service is involved. Grafana credentials come from
--grafana-token or $GRAFANA_TOKEN, falling back to --grafana-user and --grafana-password.

--incremental diffs the last synced commit against the latest one; --from-ref overrides the
last synced commit. Local repositories are not versioned and always get a full pull.

Examples:
  provisioning-sync plan --type github --url https://github.com/org/repo --branch main
  provisioning-sync plan --type local --path ./dashboards
  provisioning-sync pull --repo my-repo
  provisioning-sync pull --repo my-repo --incremental

Flags:
`

type options struct {
	command     string
	incremental bool
	fromRef     string
	jsonOutput  bool
	verbose     bool

	grafanaURL      string
	grafanaToken    string
	grafanaUser     string
	grafanaPassword string
	namespace       string
	repoName        string

	repoType  string
	url       string
	branch    string
	path      string
	tokenUser string
	homePath  string
	token     string
}

var errHelp = errors.New("help requested")

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	err := run(ctx, os.Args[1:], os.Stdout, os.Stderr)
	if errors.Is(err, errHelp) {
		return
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, stdout, stderr io.Writer) error {
	opts, err := parseOptions(args, stderr)
	if err != nil {
		return err
	}

	level := slog.LevelWarn
	if opts.verbose {
		level = slog.LevelDebug
	}
	logging.DefaultLogger = logging.NewSLogLogger(slog.NewTextHandler(stderr, &slog.HandlerOptions{Level: level}))

	if opts.command == commandPlan {
		return runPlan(ctx, opts, stdout)
	}
	return runPull(ctx, opts, stdout)
}

func parseOptions(args []string, output io.Writer) (options, error) {
	fs := flag.NewFlagSet("provisioning-sync", flag.ContinueOnError)
	fs.SetOutput(output)
	fs.Usage = func() {
		fmt.Fprint(output, usage)
		fs.PrintDefaults()
	}

	if len(args) == 0 || (args[0] != commandPlan && args[0] != commandPull) {
		fs.Usage()
		if len(args) > 0 && (args[0] == "-h" || args[0] == "--help" || args[0] == "help") {
			return options{}, errHelp
		}
		return options{}, fmt.Errorf("expected a %q or %q command", commandPlan, commandPull)
	}

	opts := options{command: args[0]}
	fs.BoolVar(&opts.incremental, "incremental", false, "diff the last synced commit against the latest one instead of the whole tree")
	fs.StringVar(&opts.fromRef, "from-ref", "", "commit to treat as the last synced one (overrides status.sync.lastRef)")
	fs.BoolVar(&opts.jsonOutput, "json", false, "print the result as JSON")
	fs.BoolVar(&opts.verbose, "verbose", false, "log debug output to stderr")

	fs.StringVar(&opts.grafanaURL, "grafana-url", "http://localhost:3000", "Grafana URL")
	fs.StringVar(&opts.grafanaToken, "grafana-token", "", "Grafana service account token (default $"+grafanaTokenEnv+")")
	fs.StringVar(&opts.grafanaUser, "grafana-user", "admin", "Grafana basic auth user, used without a token")
	fs.StringVar(&opts.grafanaPassword, "grafana-password", "admin", "Grafana basic auth password, used without a token")
	fs.StringVar(&opts.namespace, "namespace", "default", "Grafana namespace of the repository")
	fs.StringVar(&opts.repoName, "repo", "", "name of a Repository in Grafana")

	fs.StringVar(&opts.repoType, "type", "", "repository type when not using --repo: git, github or local")
	fs.StringVar(&opts.url, "url", "", "git or GitHub repository URL")
	fs.StringVar(&opts.branch, "branch", "main", "git or GitHub branch")
	fs.StringVar(&opts.path, "path", "", "subdirectory in a git or GitHub repository, or the directory of a local one")
	fs.StringVar(&opts.tokenUser, "token-user", "", "git token user, for providers that need one")
	fs.StringVar(&opts.homePath, "home-path", ".", "directory a relative local repository path resolves against")
	fs.StringVar(&opts.token, "token", "", "repository token (default $"+repoTokenEnv+")")

	if err := fs.Parse(args[1:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return options{}, errHelp
		}
		return options{}, err
	}
	if fs.NArg() > 0 {
		return options{}, fmt.Errorf("unexpected arguments: %v", fs.Args())
	}

	if opts.token == "" {
		opts.token = os.Getenv(repoTokenEnv)
	}
	if opts.grafanaToken == "" {
		opts.grafanaToken = os.Getenv(grafanaTokenEnv)
	}

	switch {
	case opts.repoName == "" && opts.repoType == "":
		return options{}, errors.New("set --repo to read the repository from Grafana, or --type to describe it")
	case opts.repoName != "" && opts.repoType != "":
		return options{}, errors.New("--repo and --type cannot be used together")
	case opts.command == commandPull && opts.repoName == "":
		return options{}, errors.New("pull writes its status to a Repository in Grafana; set --repo")
	}

	return opts, nil
}
