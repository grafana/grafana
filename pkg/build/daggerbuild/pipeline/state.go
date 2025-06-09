package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
)

var (
	ErrorUnexpectedType = errors.New("unexpected type in state")
)

type StateHandler interface {
	String(context.Context, Argument) (string, error)
	Int64(context.Context, Argument) (int64, error)
	Bool(context.Context, Argument) (bool, error)
	File(context.Context, Argument) (*dagger.File, error)
	Directory(context.Context, Argument) (*dagger.Directory, error)
	CacheVolume(context.Context, Argument) (*dagger.CacheVolume, error)
}

// State stores the overall state of the application. Externally, it is read-only.
// It starts every run completely empty. As arguments are needed by other arguments, their ValueFuncs are called
// when fetched from the state and then stored for future re-use.
type State struct {
	Data sync.Map
	Log  *slog.Logger

	// These two fields are only here so that the state can call the ValueFunc of each argument if it's not already available in the state.
	CLIContext cliutil.CLIContext
	Client     *dagger.Client
	Platform   dagger.Platform
}

func (s *State) ArgumentOpts() *ArgumentOpts {
	return &ArgumentOpts{
		Log:        s.Log,
		CLIContext: s.CLIContext,
		Client:     s.Client,
		State:      s,
		Platform:   s.Platform,
	}
}

func (s *State) String(ctx context.Context, arg Argument) (string, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		str, ok := v.(string)
		if !ok {
			return "", fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return str, nil
	}

	str, err := arg.String(ctx, s.ArgumentOpts())
	if err != nil {
		return "", err
	}

	s.Data.Store(arg.Name, str)
	return str, nil
}

func (s *State) Int64(ctx context.Context, arg Argument) (int64, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		val, ok := v.(int64)
		if !ok {
			return 0, fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return val, nil
	}

	val, err := arg.Int64(ctx, s.ArgumentOpts())
	if err != nil {
		return 0, err
	}

	s.Data.Store(arg.Name, val)
	return val, nil
}

func (s *State) Bool(ctx context.Context, arg Argument) (bool, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		val, ok := v.(bool)
		if !ok {
			return false, fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return val, nil
	}

	val, err := arg.Bool(ctx, s.ArgumentOpts())
	if err != nil {
		return false, err
	}

	s.Data.Store(arg.Name, val)
	return val, nil
}

func (s *State) File(ctx context.Context, arg Argument) (*dagger.File, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		val, ok := v.(*dagger.File)
		if !ok {
			return nil, fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return val, nil
	}

	f, err := arg.File(ctx, s.ArgumentOpts())
	if err != nil {
		return nil, err
	}

	s.Data.Store(arg.Name, f)
	return f, nil
}

func (s *State) Directory(ctx context.Context, arg Argument) (*dagger.Directory, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		val, ok := v.(*dagger.Directory)
		if !ok {
			return nil, fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return val, nil
	}

	dir, err := arg.Directory(ctx, s.ArgumentOpts())
	if err != nil {
		return nil, err
	}

	s.Data.Store(arg.Name, dir)
	return dir, nil
}

func (s *State) CacheVolume(ctx context.Context, arg Argument) (*dagger.CacheVolume, error) {
	if v, ok := s.Data.Load(arg.Name); ok {
		val, ok := v.(*dagger.CacheVolume)
		if !ok {
			return nil, fmt.Errorf("%w: %s", ErrorUnexpectedType, arg.Name)
		}

		return val, nil
	}

	dir, err := arg.CacheVolume(ctx, s.ArgumentOpts())
	if err != nil {
		return nil, err
	}

	s.Data.Store(arg.Name, dir)
	return dir, nil
}
