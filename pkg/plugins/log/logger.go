package log

import (
	"context"
	"log/slog"
	"sync"
)

// loggerFactory is a function that creates a Logger given a name.
// It can be set by calling SetLoggerFactory to use a custom logger implementation.
var loggerFactory func(name string) Logger

// SetLoggerFactory sets the factory function used to create loggers.
// This should be called during initialization to register a custom logger implementation.
// If not set, a default slog-based logger will be used.
func SetLoggerFactory(factory func(name string) Logger) {
	loggerFactory = factory
}

var slogLogManager = &slogLoggerManager{
	cache: sync.Map{},
}

func New(name string) Logger {
	if loggerFactory != nil {
		return loggerFactory(name)
	}
	// add a caching layer since slog doesn't perform any caching itself
	return slogLogManager.getOrCreate(name)
}

type slogLoggerManager struct {
	cache sync.Map
}

func (m *slogLoggerManager) getOrCreate(name string) Logger {
	if cached, ok := m.cache.Load(name); ok {
		return cached.(*slogLogger)
	}

	logger := &slogLogger{
		logger: slog.Default().With("logger", name),
		name:   name,
	}
	actual, _ := m.cache.LoadOrStore(name, logger)
	return actual.(*slogLogger)
}

type slogLogger struct {
	logger *slog.Logger
	name   string
}

func (l *slogLogger) New(ctx ...any) Logger {
	if len(ctx) == 0 {
		return &slogLogger{
			logger: l.logger,
			name:   l.name,
		}
	}
	return &slogLogger{
		logger: l.logger.With(ctx...),
		name:   l.name,
	}
}

func (l *slogLogger) Debug(msg string, ctx ...any) {
	l.logger.Debug(msg, ctx...)
}

func (l *slogLogger) Info(msg string, ctx ...any) {
	l.logger.Info(msg, ctx...)
}

func (l *slogLogger) Warn(msg string, ctx ...any) {
	l.logger.Warn(msg, ctx...)
}

func (l *slogLogger) Error(msg string, ctx ...any) {
	l.logger.Error(msg, ctx...)
}

func (l *slogLogger) FromContext(_ context.Context) Logger {
	return l
}
