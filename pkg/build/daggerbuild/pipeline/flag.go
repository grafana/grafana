package pipeline

import (
	"errors"
	"fmt"
	"strings"
)

type FlagOption string

// A Flag is a single component of an artifact string.
// For example, in the artifact string `linux/amd64:targz:enterprise`, the flags are
// `linux/amd64`, `targz`, and `enterprise`. Artifacts define what flags are allowed to be set on them, and handle applying those flags
// in their constructors.
type Flag struct {
	Name    string
	Options map[FlagOption]any
}

// OptionsHandler is used for storing and setting options populated from artifact flags in a map.
type OptionsHandler struct {
	Artifact string
	Options  map[FlagOption]any
}

func NewOptionsHandler(artifact string) *OptionsHandler {
	return &OptionsHandler{
		Artifact: artifact,
		Options:  map[FlagOption]any{},
	}
}

var (
	ErrorDuplicateFlagOption = errors.New("another flag has already set this option")
	ErrorFlagOptionNotFound  = errors.New("no flag provided the requested option")
)

func (o *OptionsHandler) Apply(flag Flag) error {
	for k, v := range flag.Options {
		if _, ok := o.Options[k]; ok {
			return fmt.Errorf("flag: %s, option: %s, error: %w", flag.Name, k, ErrorDuplicateFlagOption)
		}
		o.Options[k] = v
	}
	return nil
}

func (o *OptionsHandler) Get(option FlagOption) (any, error) {
	val, ok := o.Options[option]
	if !ok {
		return "", fmt.Errorf("[%s] %s: %w", o.Artifact, option, ErrorFlagOptionNotFound)
	}

	return val, nil
}

func (o *OptionsHandler) String(option FlagOption) (string, error) {
	v, err := o.Get(option)
	if err != nil {
		return "", err
	}

	return v.(string), nil
}

func (o *OptionsHandler) StringSlice(option FlagOption) ([]string, error) {
	v, err := o.Get(option)
	if err != nil {
		return nil, err
	}

	return v.([]string), nil
}

func (o *OptionsHandler) Bool(option FlagOption) (bool, error) {
	v, err := o.Get(option)
	if err != nil {
		if errors.Is(err, ErrorFlagOptionNotFound) {
			return false, nil
		}

		return false, err
	}

	return v.(bool), nil
}

func ParseFlags(artifact string, flags []Flag) (*OptionsHandler, error) {
	h := NewOptionsHandler(artifact)
	f := strings.Split(artifact, ":")

	for _, v := range f {
		for _, flag := range flags {
			if flag.Name != v {
				continue
			}

			if err := h.Apply(flag); err != nil {
				return nil, err
			}
		}
	}

	return h, nil
}
