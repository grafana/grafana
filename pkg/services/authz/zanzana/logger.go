package zanzana

import (
	"context"

	"go.uber.org/zap"

	"github.com/grafana/grafana/pkg/infra/log"
)

// zanzanaLogger is a grafana logger wrapper compatible with OpenFGA logger interface
type zanzanaLogger struct {
	logger log.Logger
}

func newZanzanaLogger(logger log.Logger) *zanzanaLogger {
	return &zanzanaLogger{
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

func (l *zanzanaLogger) Debug(msg string, fields ...zap.Field) {
	l.logger.Debug(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) Info(msg string, fields ...zap.Field) {
	l.logger.Info(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) Warn(msg string, fields ...zap.Field) {
	l.logger.Warn(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) Error(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) Panic(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) Fatal(msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) DebugWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Debug(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) InfoWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Info(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) WarnWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Warn(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) ErrorWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) PanicWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}

func (l *zanzanaLogger) FatalWithContext(ctx context.Context, msg string, fields ...zap.Field) {
	l.logger.Error(msg, zapFieldsToArgs(fields)...)
}
