// Command provisioning-sync runs the provisioning pull (sync) and push (export) jobs from the
// command line, for development and testing against git, GitHub and local repositories.
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
	commandPush = "push"

	repoTokenEnv     = "PROVISIONING_REPO_TOKEN"
	grafanaTokenEnv  = "GRAFANA_TOKEN"
	accessTokenEnv   = "GRAFANA_ACCESS_TOKEN"
	exchangeTokenEnv = "GRAFANA_EXCHANGE_TOKEN"
)

const usage = `provisioning-sync runs the provisioning pull and push jobs from the command line.

Usage:
  provisioning-sync plan [flags]   print what a pull would change, without writing anything
  provisioning-sync pull [flags]   run the pull (sync) job: repository -> Grafana
  provisioning-sync push [flags]   run the push (export) job: unmanaged Grafana resources -> repository

The repository is either:
  - a Repository in Grafana (--repo): its status is patched exactly as a pull job does, or
  - described with --type and its settings, with no Repository in Grafana: resources are
    managed under --name, and the sync status, including the last synced commit, is kept in
    --state-file (default .provisioning-sync/<namespace>/<name>.json).
plan --offline compares a repository described with --type against an empty instance and
needs no Grafana.

The repository token comes from --token or $PROVISIONING_REPO_TOKEN and is used instead of
the token Grafana stores, so no secrets service is involved.

Grafana only lets the provisioning service identity write repository-managed resources, so
pull needs an access token for it, like the standalone operator uses: either minted per
request with --token-exchange-url and --exchange-token ($GRAFANA_EXCHANGE_TOKEN), or given
with --access-token ($GRAFANA_ACCESS_TOKEN). plan only reads, so a user is enough: --grafana-token
($GRAFANA_TOKEN) or --grafana-user and --grafana-password. So does push, which only writes to
the repository.

--incremental diffs the last synced commit against the latest one; --from-ref overrides the
last synced commit. Local repositories are not versioned and always get a full pull.

push commits everything in one commit (--message) to the configured branch, or to a new one
with --push-branch, under --push-path. Exported resources get new names unless --keep-uids is
set, as the export job does; --keep-uids is what migration uses, so a later pull takes them over.
Folders keep their UIDs in _folder.json unless --new-folder-ids is set.

Examples:
  provisioning-sync plan --type github --url https://github.com/org/repo --branch main --offline
  provisioning-sync plan --type local --path ./dashboards --offline
  provisioning-sync pull --type github --url https://github.com/org/repo --name demo --access-token "$ACCESS_TOKEN"
  provisioning-sync pull --type github --url https://github.com/org/repo --name demo --access-token "$ACCESS_TOKEN" --incremental
  provisioning-sync plan --repo my-repo --incremental
  provisioning-sync pull --repo my-repo --token-exchange-url http://localhost:6481/sign/access-token
  provisioning-sync pull --repo my-repo --access-token "$ACCESS_TOKEN" --incremental
  provisioning-sync push --type github --url https://github.com/org/repo --push-branch export --message "Export"
  provisioning-sync push --type local --path ./dashboards --keep-uids

Flags:
`

type options struct {
	command     string
	incremental bool
	fromRef     string
	jsonOutput  bool
	verbose     bool
	offline     bool

	message    string
	pushBranch string
	pushPath   string
	keepUIDs   bool
	newFolders bool

	grafanaURL       string
	grafanaToken     string
	grafanaUser      string
	grafanaPassword  string
	accessToken      string
	tokenExchangeURL string
	exchangeToken    string
	namespace        string
	repoName         string

	repoType  string
	name      string
	stateFile string
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

	switch opts.command {
	case commandPlan:
		return runPlan(ctx, opts, stdout)
	case commandPush:
		return runPush(ctx, opts, stdout)
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

	if len(args) == 0 || (args[0] != commandPlan && args[0] != commandPull && args[0] != commandPush) {
		fs.Usage()
		if len(args) > 0 && (args[0] == "-h" || args[0] == "--help" || args[0] == "help") {
			return options{}, errHelp
		}
		return options{}, fmt.Errorf("expected a %q, %q or %q command", commandPlan, commandPull, commandPush)
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
	fs.StringVar(&opts.accessToken, "access-token", "", "access token for the provisioning service identity (default $"+accessTokenEnv+")")
	fs.StringVar(&opts.tokenExchangeURL, "token-exchange-url", "", "token exchange endpoint that mints access tokens for the provisioning service identity")
	fs.StringVar(&opts.exchangeToken, "exchange-token", "", "token presented to --token-exchange-url (default $"+exchangeTokenEnv+")")
	fs.StringVar(&opts.namespace, "namespace", "default", "Grafana namespace of the repository")
	fs.StringVar(&opts.repoName, "repo", "", "name of a Repository in Grafana")

	fs.StringVar(&opts.repoType, "type", "", "repository type when not using --repo: git, github or local")
	fs.StringVar(&opts.name, "name", flagRepositoryName, "repository name that resources pulled with --type are managed under")
	fs.StringVar(&opts.stateFile, "state-file", "", "file keeping the sync status of a repository described with --type (default .provisioning-sync/<namespace>/<name>.json)")
	fs.BoolVar(&opts.offline, "offline", false, "plan a repository described with --type against an empty instance, without Grafana")

	fs.StringVar(&opts.message, "message", "", "push: commit message (default \"Export from Grafana <job>\")")
	fs.StringVar(&opts.pushBranch, "push-branch", "", "push: git branch to commit to, created if missing (default --branch)")
	fs.StringVar(&opts.pushPath, "push-path", "", "push: directory in the repository to write under")
	fs.BoolVar(&opts.keepUIDs, "keep-uids", false, "push: keep resource names instead of generating new ones")
	fs.BoolVar(&opts.newFolders, "new-folder-ids", false, "push: write new folder UIDs to _folder.json, so pulling the export does not collide with the original folders")
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
	switch {
	case opts.tokenExchangeURL != "" && opts.exchangeToken == "":
		return errors.New("--token-exchange-url needs --exchange-token or $" + exchangeTokenEnv)
	case opts.repoName == "" && opts.repoType == "":
		return errors.New("set --repo to read the repository from Grafana, or --type to describe it")
	case opts.repoName != "" && opts.repoType != "":
		return errors.New("--repo and --type cannot be used together")
	case opts.repoName != "" && (opts.stateFile != "" || opts.offline):
		return errors.New("--state-file and --offline are for repositories described with --type; --repo keeps its status in Grafana")
	case opts.offline && opts.command != commandPlan:
		return errors.New("--offline only works with plan")
	case opts.command == commandPush && (opts.incremental || opts.fromRef != ""):
		return errors.New("--incremental and --from-ref are for pull and plan; push always exports everything")
	case opts.command != commandPush && (opts.message != "" || opts.pushBranch != "" || opts.pushPath != "" || opts.keepUIDs || opts.newFolders):
		return errors.New("--message, --push-branch, --push-path, --keep-uids and --new-folder-ids only work with push")
	case opts.command == commandPull && opts.tokenExchangeURL == "" && opts.accessToken == "":
		return errors.New("pull writes repository-managed resources, which Grafana only accepts from the provisioning service identity; set --token-exchange-url or --access-token")
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
