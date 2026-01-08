// logemitter is a test utility that emits OpenTelemetry logs to an OTLP endpoint.
// It sends both audit logs (with audit=true attribute) and regular logs
// to test the filtering functionality of the Alloy pipeline.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"

	otellog "go.opentelemetry.io/otel/log"
)

var (
	auditActions = []string{
		"user.login",
		"user.logout",
		"user.password_change",
		"resource.create",
		"resource.update",
		"resource.delete",
		"permission.grant",
		"permission.revoke",
		"api_key.create",
		"api_key.delete",
	}

	regularMessages = []string{
		"Processing request",
		"Cache hit",
		"Cache miss",
		"Database query executed",
		"Connection established",
		"Heartbeat received",
		"Metrics collected",
		"Configuration reloaded",
	}
)

func main() {
	var (
		endpoint       = flag.String("endpoint", "localhost:4317", "OTLP gRPC endpoint")
		intervalMs     = flag.Int("interval", 1000, "Interval between log emissions in milliseconds")
		auditRatio     = flag.Float64("audit-ratio", 0.3, "Ratio of audit logs (0.0 to 1.0)")
		serviceName    = flag.String("service", "test-app", "Service name for logs")
		insecure       = flag.Bool("insecure", true, "Use insecure connection (no TLS)")
	)
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Set up signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Initialize OTLP exporter
	opts := []otlploggrpc.Option{
		otlploggrpc.WithEndpoint(*endpoint),
	}
	if *insecure {
		opts = append(opts, otlploggrpc.WithInsecure())
	}

	exporter, err := otlploggrpc.New(ctx, opts...)
	if err != nil {
		log.Fatalf("Failed to create OTLP exporter: %v", err)
	}

	// Create resource without merging with Default() to avoid schema URL conflicts
	res := resource.NewSchemaless(
		attribute.String("service.name", *serviceName),
		attribute.String("service.version", "1.0.0"),
	)

	// Create logger provider
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
		sdklog.WithResource(res),
	)
	defer func() {
		if err := loggerProvider.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down logger provider: %v", err)
		}
	}()

	// Set global logger provider
	global.SetLoggerProvider(loggerProvider)
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		log.Printf("OTel error: %v", err)
	}))

	logger := loggerProvider.Logger("logemitter")

	log.Printf("Starting log emitter")
	log.Printf("  Endpoint: %s", *endpoint)
	log.Printf("  Interval: %dms", *intervalMs)
	log.Printf("  Audit ratio: %.0f%%", *auditRatio*100)
	log.Printf("  Service: %s", *serviceName)
	log.Printf("")
	log.Println("Press Ctrl+C to stop")

	ticker := time.NewTicker(time.Duration(*intervalMs) * time.Millisecond)
	defer ticker.Stop()

	counter := 0
	for {
		select {
		case <-sigChan:
			log.Println("Shutting down...")
			return
		case <-ticker.C:
			counter++
			isAudit := rand.Float64() < *auditRatio

			if isAudit {
				emitAuditLog(ctx, logger, counter)
			} else {
				emitRegularLog(ctx, logger, counter)
			}
		}
	}
}

func emitAuditLog(ctx context.Context, logger otellog.Logger, counter int) {
	action := auditActions[rand.Intn(len(auditActions))]
	userID := fmt.Sprintf("user-%d", rand.Intn(1000))
	resourceID := fmt.Sprintf("resource-%d", rand.Intn(10000))

	var record otellog.Record
	record.SetTimestamp(time.Now())
	record.SetSeverity(otellog.SeverityInfo)
	record.SetSeverityText("INFO")
	record.SetBody(otellog.StringValue(fmt.Sprintf("Audit event #%d: %s", counter, action)))

	record.AddAttributes(
		otellog.Bool("audit", true),
		otellog.String("action", action),
		otellog.String("user.id", userID),
		otellog.String("resource.id", resourceID),
		otellog.String("source.ip", fmt.Sprintf("192.168.1.%d", rand.Intn(255))),
		otellog.Int64("event.id", int64(counter)),
	)

	logger.Emit(ctx, record)
	log.Printf("[AUDIT] #%d %s by %s on %s", counter, action, userID, resourceID)
}

func emitRegularLog(ctx context.Context, logger otellog.Logger, counter int) {
	message := regularMessages[rand.Intn(len(regularMessages))]

	severities := []otellog.Severity{
		otellog.SeverityDebug,
		otellog.SeverityInfo,
		otellog.SeverityWarn,
	}
	severity := severities[rand.Intn(len(severities))]

	var record otellog.Record
	record.SetTimestamp(time.Now())
	record.SetSeverity(severity)
	record.SetSeverityText(severity.String())
	record.SetBody(otellog.StringValue(fmt.Sprintf("Log #%d: %s", counter, message)))

	record.AddAttributes(
		otellog.Bool("audit", false),
		otellog.String("component", "worker"),
		otellog.Int64("request.id", int64(rand.Intn(100000))),
	)

	logger.Emit(ctx, record)
	log.Printf("[REGULAR] #%d %s (severity: %s)", counter, message, severity.String())
}

