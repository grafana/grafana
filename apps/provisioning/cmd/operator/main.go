package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

func main() {
	logger := logging.DefaultLogger.With("component", "provisioning")
	logger.Info("Starting standalone repository controller")

	// Get configuration from environment
	namespace := getEnvOrDefault("NAMESPACE", "default")
	workerCount := getEnvOrDefault("WORKER_COUNT", "2")
	cloneDir := getEnvOrDefault("CLONE_DIR", "/tmp/grafana-repos")

	logger.Info("Configuration loaded",
		"namespace", namespace,
		"workerCount", workerCount,
		"cloneDir", cloneDir)

	// Set up signal handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Simulate controller work
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				logger.Info("Repository controller heartbeat",
					"namespace", namespace,
					"timestamp", time.Now().Format(time.RFC3339))
			}
		}
	}()

	// Wait for shutdown signal
	select {
	case <-sigChan:
		logger.Info("Received shutdown signal, stopping controller...")
		cancel()

		// Give the controller time to shut down gracefully
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		select {
		case <-shutdownCtx.Done():
			logger.Warn("Shutdown timeout reached")
		case <-ctx.Done():
			logger.Info("Controller stopped gracefully")
		}
	}

	logger.Info("Repository controller stopped")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
