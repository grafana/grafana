// Command provisioning-sync runs the provisioning sync, export and fix-folder-metadata jobs from
// the command line, for development and testing against git, GitHub and local repositories.
// Commands follow gcx: pull goes from Grafana to the repository, push from the repository to Grafana.
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
	commandPull = "pull"
	commandPush = "push"
	commandFix  = "fix"

	repoTokenEnv     = "PROVISIONING_REPO_TOKEN"
	grafanaTokenEnv  = "GRAFANA_TOKEN"
	accessTokenEnv   = "GRAFANA_ACCESS_TOKEN"
	exchangeTokenEnv = "GRAFANA_EXCHANGE_TOKEN"
)

const usage = `provisioning-sync runs the provisioning jobs from the command line.

Usage:
  provisioning-sync pull [flags]                  run the export job: unmanaged Grafana resources -> repository
  provisioning-sync push [flags]                  run the sync job: repository -> Grafana
  provisioning-sync push --dry-run [flags]        print what a push would change, without writing anything
  provisioning-sync fix [flags]                   run the fix-folder-metadata job: write the missing _folder.json files

The repository is described with --type and its settings; no Repository resource is needed.
Pushed resources are managed by repo --name (default gcx), and the sync status, including
the last synced commit for --incremental, is kept in --state-file between runs.

push writes repository-managed resources, which Grafana only accepts from the provisioning
service identity: set --token-exchange-url or --access-token. The other commands only read
from Grafana, so a user is enough.

Examples:
  provisioning-sync push --type github --url https://github.com/org/repo --dry-run --offline
  provisioning-sync push --type github --url https://github.com/org/repo --access-token "$ACCESS_TOKEN" --incremental
  provisioning-sync push --type local --path ./dashboards --token-exchange-url http://localhost:6481/sign/access-token
  provisioning-sync pull --type github --url https://github.com/org/repo --write-branch export --message "Export"
  provisioning-sync fix --type github --url https://github.com/org/repo --write-branch fix-folders

Flags:
`

type options struct {
	command     string
	incremental bool
	fromRef     string
	jsonOutput  bool
	verbose     bool
	dryRun      bool
	offline     bool

	message     string
	writeBranch string
	writePath   string
	keepUIDs    bool
	newFolders  bool

	grafanaURL       string
	grafanaToken     string
	grafanaUser      string
	grafanaPassword  string
	accessToken      string
	tokenExchangeURL string
	exchangeToken    string
	namespace        string

	repoType  string
	name      string
	stateFile string
	url       string
	branch    string
	path      string
	tokenUser string
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

	switch opts.command {
	case commandPush:
		return runPush(ctx, opts, stdout)
	case commandFix:
		return runFix(ctx, opts, stdout)
	default:
		return runPull(ctx, opts, stdout)
	}
}

func parseOptions(args []string, output io.Writer) (options, error) {
	fs := flag.NewFlagSet("provisioning-sync", flag.ContinueOnError)
	fs.SetOutput(output)
	fs.Usage = func() {
		_, _ = fmt.Fprint(output, usage)
		fs.PrintDefaults()
	}

	if len(args) == 0 || (args[0] != commandPull && args[0] != commandPush && args[0] != commandFix) {
		fs.Usage()
		if len(args) > 0 && (args[0] == "-h" || args[0] == "--help" || args[0] == "help") {
			return options{}, errHelp
		}
		return options{}, fmt.Errorf("expected a %q, %q or %q command", commandPull, commandPush, commandFix)
	}

	opts := options{command: args[0]}
	fs.BoolVar(&opts.incremental, "incremental", false, "push: diff the last synced commit against the latest one instead of the whole tree")
	fs.StringVar(&opts.fromRef, "from-ref", "", "push: commit to treat as the last synced one (overrides status.sync.lastRef)")
	fs.BoolVar(&opts.dryRun, "dry-run", false, "push: print what would change, without writing anything")
	fs.BoolVar(&opts.jsonOutput, "json", false, "print the result as JSON")
	fs.BoolVar(&opts.verbose, "verbose", false, "log debug output to stderr")

	fs.StringVar(&opts.grafanaURL, "grafana-url", "http://localhost:3000", "Grafana URL")
	fs.StringVar(&opts.grafanaToken, "grafana-token", "", "Grafana service account token (default $"+grafanaTokenEnv+")")
	fs.StringVar(&opts.grafanaUser, "grafana-user", "admin", "Grafana basic auth user, used without a token")
	fs.StringVar(&opts.grafanaPassword, "grafana-password", "admin", "Grafana basic auth password, used without a token")
	fs.StringVar(&opts.accessToken, "access-token", "", "access token for the provisioning service identity (default $"+accessTokenEnv+")")
	fs.StringVar(&opts.tokenExchangeURL, "token-exchange-url", "", "token exchange endpoint that mints access tokens for the provisioning service identity")
	fs.StringVar(&opts.exchangeToken, "exchange-token", "", "token presented to --token-exchange-url (default $"+exchangeTokenEnv+")")
	fs.StringVar(&opts.namespace, "namespace", "default", "Grafana namespace of the repository")

	fs.StringVar(&opts.repoType, "type", "", "repository type: git, github or local")
	fs.StringVar(&opts.name, "name", defaultManager, "repository name, which pushed resources are managed under")
	fs.StringVar(&opts.stateFile, "state-file", "", "file keeping the sync status between runs (default <user config dir>/grafana-provisioning-sync/<namespace>/<name>.json)")
	fs.BoolVar(&opts.offline, "offline", false, "push --dry-run: compare against an empty instance, without Grafana")

	fs.StringVar(&opts.message, "message", "", "pull, fix: commit message")
	fs.StringVar(&opts.writeBranch, "write-branch", "", "pull, fix: git branch to commit to, created if missing (default --branch)")
	fs.StringVar(&opts.writePath, "write-path", "", "pull: directory in the repository to write under")
	fs.BoolVar(&opts.keepUIDs, "keep-uids", false, "pull: keep resource names instead of generating new ones")
	fs.BoolVar(&opts.newFolders, "new-folder-ids", false, "pull: write new folder UIDs to _folder.json, so pushing the export does not collide with the original folders")
	fs.StringVar(&opts.url, "url", "", "git or GitHub repository URL")
	fs.StringVar(&opts.branch, "branch", "main", "git or GitHub branch")
	fs.StringVar(&opts.path, "path", "", "subdirectory in a git or GitHub repository, or the directory of a local one")
	fs.StringVar(&opts.tokenUser, "token-user", "", "git token user, for providers that need one")
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

	opts.readTokensFromEnvironment()
	if err := opts.validate(); err != nil {
		return options{}, err
	}
	return opts, nil
}

// readTokensFromEnvironment fills the tokens not given as flags, so they can stay out of argv.
func (opts *options) readTokensFromEnvironment() {
	if opts.token == "" {
		opts.token = os.Getenv(repoTokenEnv)
	}
	if opts.grafanaToken == "" {
		opts.grafanaToken = os.Getenv(grafanaTokenEnv)
	}
	if opts.accessToken == "" {
		opts.accessToken = os.Getenv(accessTokenEnv)
	}
	if opts.exchangeToken == "" {
		opts.exchangeToken = os.Getenv(exchangeTokenEnv)
	}
}

func (opts *options) validate() error {
	if opts.tokenExchangeURL != "" && opts.exchangeToken == "" {
		return errors.New("--token-exchange-url needs --exchange-token or $" + exchangeTokenEnv)
	}
	if opts.repoType == "" {
		return errors.New("set --type to git, github or local")
	}
	if err := opts.validateCommandFlags(); err != nil {
		return err
	}
	if opts.command == commandPush && !opts.dryRun && opts.tokenExchangeURL == "" && opts.accessToken == "" {
		return errors.New("push writes repository-managed resources, which Grafana only accepts from the provisioning service identity; set --token-exchange-url or --access-token")
	}
	return nil
}

// validateCommandFlags rejects flags the chosen command would silently ignore.
func (opts *options) validateCommandFlags() error {
	push, pull := opts.command == commandPush, opts.command == commandPull
	switch {
	case !push && (opts.incremental || opts.fromRef != "" || opts.dryRun):
		return errors.New("--incremental, --from-ref and --dry-run only work with push")
	case opts.offline && !opts.dryRun:
		return errors.New("--offline only works with push --dry-run")
	case push && (opts.message != "" || opts.writeBranch != ""):
		return errors.New("--message and --write-branch only work with pull and fix")
	case !pull && (opts.writePath != "" || opts.keepUIDs || opts.newFolders):
		return errors.New("--write-path, --keep-uids and --new-folder-ids only work with pull")
	}
	return nil
}

// errWriter keeps the first write error, so printing code can check it once at the end.
type errWriter struct {
	w   io.Writer
	err error
}

func (e *errWriter) printf(format string, args ...any) {
	if e.err == nil {
		_, e.err = fmt.Fprintf(e.w, format, args...)
	}
}
