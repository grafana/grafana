package pipeline

import (
	"context"
	"log/slog"

	"dagger.io/dagger"
)

type StateLogger struct {
	Log     *slog.Logger
	Handler StateHandler
}

func (s *StateLogger) String(ctx context.Context, arg Argument) (string, error) {
	s.Log.Debug("Getting string from state", "arg", arg.Name)
	val, err := s.Handler.String(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting string from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got string from state", "arg", arg.Name)

	return val, err
}
func (s *StateLogger) Int64(ctx context.Context, arg Argument) (int64, error) {
	s.Log.Debug("Getting int64 from state", "arg", arg.Name)
	val, err := s.Handler.Int64(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting int64 from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got int64 from state", "arg", arg.Name)

	return val, err
}
func (s *StateLogger) Bool(ctx context.Context, arg Argument) (bool, error) {
	s.Log.Debug("Getting bool from state", "arg", arg.Name)
	val, err := s.Handler.Bool(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting bool from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got bool from state", "arg", arg.Name)

	return val, err
}
func (s *StateLogger) File(ctx context.Context, arg Argument) (*dagger.File, error) {
	s.Log.Debug("Getting file from state", "arg", arg.Name)
	val, err := s.Handler.File(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting file from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got file from state", "arg", arg.Name)

	return val, err
}
func (s *StateLogger) Directory(ctx context.Context, arg Argument) (*dagger.Directory, error) {
	s.Log.Debug("Getting directory from state", "arg", arg.Name)
	val, err := s.Handler.Directory(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting directory from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got directory from state", "arg", arg.Name)

	return val, err
}
func (s *StateLogger) CacheVolume(ctx context.Context, arg Argument) (*dagger.CacheVolume, error) {
	s.Log.Debug("Getting cache volume from state", "arg", arg.Name)
	val, err := s.Handler.CacheVolume(ctx, arg)
	if err != nil {
		s.Log.Error("Error getting cache volume from state", "arg", arg.Name, "error", err)
	}
	s.Log.Debug("Got cache volume from state", "arg", arg.Name)

	return val, err
}

func StateWithLogger(log *slog.Logger, s StateHandler) StateHandler {
	return &StateLogger{
		Log:     log,
		Handler: s,
	}
}
