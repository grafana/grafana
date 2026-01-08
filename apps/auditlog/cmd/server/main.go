package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/grafana/apps/auditlog/pkg/server"
)

func main() {
	var (
		port            = flag.Int("port", 8080, "HTTP server port")
		logLevel        = flag.String("log-level", "info", "Log level (debug, info, warn, error)")
		shutdownTimeout = flag.Duration("shutdown-timeout", 30*time.Second, "Graceful shutdown timeout")
		readTimeout     = flag.Duration("read-timeout", 15*time.Second, "HTTP read timeout")
		writeTimeout    = flag.Duration("write-timeout", 30*time.Second, "HTTP write timeout")
		idleTimeout     = flag.Duration("idle-timeout", 60*time.Second, "HTTP idle timeout")
	)
	flag.Parse()

	// Set up logger
	var level slog.Level
	switch *logLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
	slog.SetDefault(logger)

	// Create and start the server
	srv := server.New(logger)
	addr := fmt.Sprintf(":%d", *port)

	httpServer := &http.Server{
		Addr:         addr,
		Handler:      srv.Handler(),
		ReadTimeout:  *readTimeout,
		WriteTimeout: *writeTimeout,
		IdleTimeout:  *idleTimeout,
	}

	logger.Info("starting audit log server",
		"addr", addr,
		"read_timeout", *readTimeout,
		"write_timeout", *writeTimeout,
		"idle_timeout", *idleTimeout,
		"shutdown_timeout", *shutdownTimeout,
	)

	// Handle graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	logger.Info("received shutdown signal, initiating graceful shutdown")

	// Create a context with the shutdown timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), *shutdownTimeout)
	defer cancel()

	// Shutdown gracefully drains active connections
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	logger.Info("server shutdown complete")
}
