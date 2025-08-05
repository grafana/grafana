package logger

import (
	"context"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/openfga/openfga/pkg/logger"
)

var _ logger.Logger = (*ZanzanaLogger)(nil)

// ZanzanaLogger is a grafana logger wrapper compatible with OpenFGA logger interface
type ZanzanaLogger struct {
	logger log.Logger
}

func New(logger log.Logger) *ZanzanaLogger {
	return &ZanzanaLogger{
		logger: logger,
	}
}

// Simple converter for zap logger fields
func zapFieldsToArgs(fields []zap.Field) []any {
	// We need to pre-allocated space for key and value
	args := make([]any, 0, len(fields)*2)
	for _, f := range fields {
		args = append(args, f.Key)
		if f.Interface != nil {
			args = append(args, f.Interface)
		} else if f.String != "" {
			args = append(args, f.String)
		} else {
			args = append(args, f.Integer)
		}
	}
	return args
}

// With implements logger.Logger.
func (l *ZanzanaLogger) With(fields ...zapcore.Field) logger.Logger {
	return &ZanzanaLogger{
		logger: l.logger.New(zapFieldsToArgs(fields)...),
	}
}

func (l *ZanzanaLogger) Debug(msg string, fields ...zap.Field) {
	l.logger.Debug(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) Info(msg string, fields ...zap.Field) {
	l.logger.Info(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) Warn(msg string, fields ...zap.Field) {
	l.logger.Warn(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) Error(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) Panic(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) Fatal(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) DebugWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Debug(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) InfoWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Info(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) WarnWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Warn(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) ErrorWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) PanicWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *ZanzanaLogger) FatalWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}
