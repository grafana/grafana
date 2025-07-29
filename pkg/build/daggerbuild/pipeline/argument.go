package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
	"github.com/urfave/cli/v2"
)

var (
	ErrorFlagNotProvided = errors.New("flag not provided, ex: '--go-version=1.21.0'")
)

type ArgumentType int

const (
	ArgumentTypeString ArgumentType = iota
	ArgumentTypeInt64
	ArgumentTypeDirectory
	ArgumentTypeCacheVolume
	ArgumentTypeFile
	ArgumentTypeBool
)

type ArgumentOpts struct {
	Log        *slog.Logger
	CLIContext cliutil.CLIContext
	Client     *dagger.Client
	State      StateHandler
	Platform   dagger.Platform
}

type ArgumentValueFunc func(ctx context.Context, opts *ArgumentOpts) (any, error)

// An Argument is an input to a artifact command.
// It wraps the concept of a general CLI "Flag" to allow it to
// All arguments are required.
type Argument struct {
	ArgumentType ArgumentType
	Name         string
	Description  string

	// ValueFunc defines the behavior for how this artifact is populated.
	// Maybe this could be an interface instead.
	ValueFunc ArgumentValueFunc

	// If Flags are set here, then it is safe to assume that these flags will be globally set and any other pipeline / artifact using this
	// argument will be able to use these same flags.
	// Example: `--grafana-dir`, `--grafana-ref`, etc.
	Flags []cli.Flag

	// Some arguments require other arguments to be set in order to derive their value.
	// For example, the "version" argument(s) require the GrafanaDir (if the --version flag) was not set.
	Requires []Argument
}

func (a Argument) Directory(ctx context.Context, opts *ArgumentOpts) (*dagger.Directory, error) {
	if a.ValueFunc == nil {
		return nil, fmt.Errorf("error: %w. Flag missing: %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}
	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return nil, err
	}
	dir, ok := value.(*dagger.Directory)
	if !ok {
		return nil, errors.New("value returned by valuefunc is not a *dagger.Directory")
	}

	return dir, nil
}

func (a Argument) MustDirectory(ctx context.Context, opts *ArgumentOpts) *dagger.Directory {
	v, err := a.Directory(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func (a Argument) String(ctx context.Context, opts *ArgumentOpts) (string, error) {
	if a.ValueFunc == nil {
		return "", fmt.Errorf("error: %w. %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}

	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return "", err
	}
	v, ok := value.(string)
	if !ok {
		return "", errors.New("value returned by valuefunc is not a string")
	}

	return v, nil
}

func (a Argument) MustString(ctx context.Context, opts *ArgumentOpts) string {
	v, err := a.String(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func (a Argument) Int64(ctx context.Context, opts *ArgumentOpts) (int64, error) {
	if a.ValueFunc == nil {
		return 0, fmt.Errorf("error: %w. %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}
	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return 0, err
	}
	v, ok := value.(int64)
	if !ok {
		return 0, errors.New("value returned by valuefunc is not an int64")
	}

	return v, nil
}

func (a Argument) MustInt64(ctx context.Context, opts *ArgumentOpts) int64 {
	v, err := a.Int64(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func (a Argument) Bool(ctx context.Context, opts *ArgumentOpts) (bool, error) {
	if a.ValueFunc == nil {
		return false, fmt.Errorf("error: %w. %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}
	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return false, err
	}
	v, ok := value.(bool)
	if !ok {
		return false, errors.New("value returned by valuefunc is not a bool")
	}

	return v, nil
}

func (a Argument) MustBool(ctx context.Context, opts *ArgumentOpts) bool {
	v, err := a.Bool(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func (a Argument) File(ctx context.Context, opts *ArgumentOpts) (*dagger.File, error) {
	if a.ValueFunc == nil {
		return nil, fmt.Errorf("error: %w. %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}
	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return nil, err
	}
	dir, ok := value.(*dagger.File)
	if !ok {
		return nil, errors.New("value returned by valuefunc is not a *dagger.File")
	}

	return dir, nil
}

func (a Argument) MustFile(ctx context.Context, opts *ArgumentOpts) *dagger.File {
	v, err := a.File(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func (a Argument) CacheVolume(ctx context.Context, opts *ArgumentOpts) (*dagger.CacheVolume, error) {
	if a.ValueFunc == nil {
		return nil, fmt.Errorf("error: %w. %s (%s)", ErrorFlagNotProvided, a.Name, a.Description)
	}
	value, err := a.ValueFunc(ctx, opts)
	if err != nil {
		return nil, err
	}
	dir, ok := value.(*dagger.CacheVolume)
	if !ok {
		return nil, errors.New("value returned by valuefunc is not a *dagger.File")
	}

	return dir, nil
}

func (a Argument) MustCacheVolume(ctx context.Context, opts *ArgumentOpts) *dagger.CacheVolume {
	v, err := a.CacheVolume(ctx, opts)
	if err != nil {
		panic(err)
	}

	return v
}

func StringFlagValueFunc(f *cli.StringFlag) func(context.Context, *ArgumentOpts) (any, error) {
	return func(ctx context.Context, opts *ArgumentOpts) (any, error) {
		return opts.CLIContext.String(f.Name), nil
	}
}

func NewStringFlagArgument(flag *cli.StringFlag) Argument {
	return Argument{
		Name:        flag.Name,
		Description: flag.Usage,
		Flags: []cli.Flag{
			flag,
		},
		ValueFunc: StringFlagValueFunc(flag),
	}
}
