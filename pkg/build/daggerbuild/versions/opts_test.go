package versions_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/versions"
)

func TestOptsFor(t *testing.T) {
	t.Run("v9.3.0 should not have combined executables", func(t *testing.T) {
		opts := versions.OptionsFor("v9.3.0")

		if opts.CombinedExecutable.IsSet != true {
			t.Errorf("CombinedExecutable should be set for v9.3.0")
		}
		if opts.CombinedExecutable.Value != false {
			t.Errorf("CombinedExecutable should be false for v9.3.0")
		}
	})
	t.Run("v9.3.0 should not have packaging/autocomplete", func(t *testing.T) {
		opts := versions.OptionsFor("9.3.0")

		if opts.Autocomplete.IsSet != true {
			t.Errorf("Autocomplete should be set for v9.3.0")
		}
		if opts.Autocomplete.Value != false {
			t.Errorf("Autocomplete should be false for v9.3.0")
		}
	})
	t.Run("v9.3.0-beta.1 should not have packaging/autocomplete", func(t *testing.T) {
		opts := versions.OptionsFor("v9.3.0-beta.1")

		if opts.Autocomplete.IsSet != true {
			t.Errorf("Autocomplete should be set for v9.3.0-beta.1")
		}
		if opts.Autocomplete.Value != false {
			t.Errorf("Autocomplete should be false for v9.3.0-beta.1")
		}
	})
	t.Run("v10.0.1 should have packaging/autocomplete", func(t *testing.T) {
		opts := versions.OptionsFor("v10.0.1")

		if opts.Autocomplete.IsSet != true {
			t.Errorf("Autocomplete should be set for v10.0.1")
		}
		if opts.Autocomplete.Value != true {
			t.Errorf("Autocomplete should be true for v10.0.1")
		}
	})
}

func TestMerge(t *testing.T) {
	opts1 := versions.Options{
		Constraint: versions.NewNullable("^1.2.3"),
		DebPreRM:   versions.NewNullable(true),
	}

	opts2 := versions.Options{
		Constraint:         versions.NewNullable("^3.2.1"),
		CombinedExecutable: versions.NewNullable(false),
	}

	opts3 := versions.Options{
		Constraint: versions.NewNullable("^5.0.0"),
	}

	merged := versions.Merge(opts1, opts2)
	merged = versions.Merge(merged, opts3)
	t.Run("It should keep the first constraint", func(t *testing.T) {
		if merged.Constraint.Value != "^1.2.3" {
			t.Fatalf(`merged.Constraint.Value != "^1.2.3", it is '%s'`, merged.Constraint.Value)
		}
	})

	t.Run("It should use the last set 'CombinedExecutable'", func(t *testing.T) {
		if merged.CombinedExecutable.Value != false {
			t.Fatalf(`merged.Constraint.Value != false it is %t`, merged.CombinedExecutable.Value)
		}
	})

	t.Run("It should use the last set 'DebPreRM'", func(t *testing.T) {
		if merged.DebPreRM.Value != true {
			t.Fatalf(`merged.DebPreRM.Value != true, it is %t`, merged.DebPreRM.Value)
		}
	})
}
