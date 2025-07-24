package versions

import (
	"github.com/Masterminds/semver"
)

type Nullable[T any] struct {
	Value T
	IsSet bool
}

func NewNullable[T any](val T) Nullable[T] {
	return Nullable[T]{
		Value: val,
		IsSet: true,
	}
}

// Options holds the general options for each version that may be different.
type Options struct {
	Constraint Nullable[string]
	// CombinedExecutable was introduced in Grafana 9.4; it combined the `grafana-server` and `grafana-cli` commands into one `grafana` executable.
	CombinedExecutable Nullable[bool]
	// DebPreRM defines the 'prerm' script in the debian installer, introduced by this PR: https://github.com/grafana/grafana/pull/59580 in v9.5.0. Versions before v9.5.0 do not have the 'prerm' script in the grafana package.
	DebPreRM Nullable[bool]

	// Automcplete (in packaging/autocomplete) was added in Grafana 9.4.0, so we should not try to include this folder in the package before then.
	Autocomplete Nullable[bool]
}

func MergeNullables[T any](values ...Nullable[T]) Nullable[T] {
	val := values[0]
	for _, v := range values {
		if v.IsSet {
			val = v
		}
	}

	return val
}

func Merge(from, to Options) Options {
	return Options{
		Constraint:         from.Constraint,
		CombinedExecutable: MergeNullables(from.CombinedExecutable, to.CombinedExecutable),
		DebPreRM:           MergeNullables(from.DebPreRM, to.DebPreRM),
		Autocomplete:       MergeNullables(from.Autocomplete, to.Autocomplete),
	}
}

// LatestOptions are the options that apply to the latest version of Grafana
var LatestOptions = Options{
	Autocomplete:       NewNullable(true),
	CombinedExecutable: NewNullable(true),
	DebPreRM:           NewNullable(true),
}

// OptionsList is a list of semver filters and corresponding options.
// If multiple constraints match the given semver, then they are merged in the order they appear, where later entries override earlier ones.
// These options should only exist if they are contrary to the LatestOptions, as the applicable options will be merged with it. In the event of any conflicts, the options in this list will override those in the LatestOptions.
var OptionsList = []Options{
	{
		Constraint: NewNullable("< 9.5.0-0"),
		DebPreRM:   NewNullable(false),
	},
	{
		Constraint:         NewNullable("< 9.3.7-0"),
		CombinedExecutable: NewNullable(false),
	},
	{
		Constraint:   NewNullable("< 9.4.0-0"), // The -0 includes prereleases. Without it, prereleases are ignored from comparison. I don't really know why??? but it is what it is.
		Autocomplete: NewNullable(false),
	},
	{
		Constraint:         NewNullable(">= 9.2.11-0, < 9.3.0-0"), // The combined executable change was backported to 9.2.x at v9.2.11
		CombinedExecutable: NewNullable(true),
	},
}

// OptionsFor returns the options found for a given version. If no versions that matched were found, then the result of "LatestOptions" is returned.
func OptionsFor(version string) Options {
	opts := LatestOptions
	smversion, err := semver.NewVersion(version)
	if err != nil {
		return opts
	}

	for _, v := range OptionsList {
		c, err := semver.NewConstraint(v.Constraint.Value)
		if err != nil {
			continue
		}
		if !c.Check(smversion) {
			continue
		}

		// This version matches the semver, override all options set in 'opts' with those set in 'v'
		opts = Merge(opts, v)
	}

	return opts
}
