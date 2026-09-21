package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/grafana/grafana/apps/errortracking/pkg/server"
	"github.com/grafana/grafana/apps/errortracking/pkg/storage"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error-tracking: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("expected serve or migrate")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	switch args[0] {
	case "serve":
		flags := flag.NewFlagSet("serve", flag.ContinueOnError)
		configPath := flags.String("config", "/etc/error-tracking/config.json", "path to the server configuration")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if flags.NArg() != 0 {
			return fmt.Errorf("serve does not accept positional arguments")
		}
		config, err := server.LoadConfig(*configPath)
		if err != nil {
			return err
		}
		return server.Run(ctx, config)
	case "migrate":
		if len(args) != 1 {
			return fmt.Errorf("migrate does not accept arguments")
		}
		runtimeRole := strings.TrimSpace(os.Getenv("ERROR_TRACKING_RUNTIME_ROLE"))
		if runtimeRole == "" {
			return fmt.Errorf("ERROR_TRACKING_RUNTIME_ROLE is required")
		}
		return storage.Migrate(ctx, os.Getenv("ERROR_TRACKING_DATABASE_URL"), runtimeRole)
	default:
		return fmt.Errorf("unknown command %q; expected serve or migrate", args[0])
	}
}
