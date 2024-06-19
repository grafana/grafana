package zanzana

import (
	"context"

	"go.uber.org/zap"

	"github.com/grafana/grafana/pkg/infra/log"
)

// ZanzanaLogger is a grafana logger wrapper compatible with OpenFGA logger interface
type ZanzanaLogger struct {
	logger *log.ConcreteLogger
}

func NewZanzanaLogger() *ZanzanaLogger {
	logger := log.New("openfga-server")

	return &ZanzanaLogger{
		logger: logger,
	}
}

// Simple converter for zap logger fields
func zapFieldsToArgs(fields []zap.Field) []any {
	args := make([]any, 0)
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
