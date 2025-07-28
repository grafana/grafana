package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"

	"github.com/grafana/grafana/e2e/internal/cmd"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	if err := cmd.Root().Run(ctx, os.Args); err != nil {
		cancel()
		fmt.Println(err)
		os.Exit(1)
	}
}
