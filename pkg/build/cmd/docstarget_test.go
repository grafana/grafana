package main

import (
	"fmt"
	"strings"
	"testing"
)

func TestDocsTarget(t *testing.T) {
	t.Run("version like references or known refs", func(t *testing.T) {
		for _, tc := range []struct {
			in   string
			want string
		}{
			{"main", "next"},
			{"master", "next"},
			{"v1.2.3", "v1.2"},
			{"release-1.3", "v1.3"},
			{"release-1.4.0", "v1.4"},
			{"mimir-2.0.1", "v2.0"},
		} {
			got, err := docsTarget(tc.in)
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				continue
			}
			if got != tc.want {
				t.Errorf("Unexpected output for ref %q: wanted %q, got %q", tc.in, tc.want, got)
			}
		}
	})
}

func TestCoerce(t *testing.T) {
	// https://github.com/npm/node-semver/blob/c1d1952141d84a62b1df683f651e123d2d81ca1b/test/functions/coerce.js#L7-L31
	t.Run("cannot be coerced", func(t *testing.T) {
		versions := []string{
			// null,
			// Not applicable because function signature insists on string input.
			// { version: '1.2.3' },
			// Not applicable because function signature insists on string input.
			// function () {
			//   return '1.2.3'
			// },
			// Not applicable because function signature insists on string input.
			// '',
			"",
			// '.',
			".",
			// 'version one',
			"version one",
			// '9'.repeat(16),
			// TODO: Correct behavior for the following test case.
			// TODO: Understand why '1'.repeat(16) is fine but '9'.repeat(16) is not.
			// https://github.com/npm/node-semver/blob/main/test/functions/coerce.js#L93
			// https://github.com/npm/node-semver/blob/main/test/functions/coerce.js#L17
			// strings.Repeat("9", 16),

			// '1'.repeat(17),
			strings.Repeat("1", 17),
			// `a${'9'.repeat(16)}`,
			// TODO: Correct behavior for the following test case.
			// It might be related to '9'.repeat(16) above.
			// "a" + strings.Repeat("9", 16),

			// `a${'1'.repeat(17)}`,
			"a" + strings.Repeat("1", 17),

			// `${'9'.repeat(16)}a`,
			// TODO: Correct behavior for the following test case.
			// It might be related to '9'.repeat(16) above.
			// strings.Repeat("9", 16) + "a",

			// `${'1'.repeat(17)}a`,
			strings.Repeat("1", 17) + "a",

			// `${'9'.repeat(16)}.4.7.4`,
			// TODO: Correct behavior for the following test case.
			// It might be related to '9'.repeat(16) above.
			// strings.Repeat("9", 16) + ".4.7.4",

			// `${'9'.repeat(16)}.${'2'.repeat(16)}.${'3'.repeat(16)}`,
			strings.Repeat("9", 16) + strings.Repeat("2", 16) + strings.Repeat("3", 16),
			// `${'1'.repeat(16)}.${'9'.repeat(16)}.${'3'.repeat(16)}`,
			strings.Repeat("1", 16) + strings.Repeat("9", 16) + strings.Repeat("3", 16),
			// `${'1'.repeat(16)}.${'2'.repeat(16)}.${'9'.repeat(16)}`,
			strings.Repeat("1", 16) + strings.Repeat("2", 16) + strings.Repeat("9", 16),
		}
		for _, version := range versions {
			got, err := coerce(version, semverOpts{RTL: false})
			if err == nil { // No error!
				t.Errorf("Unexpected successful coercion of version %q to %q", version, got)
			}
		}
	})

	// https://github.com/npm/node-semver/blob/c1d1952141d84a62b1df683f651e123d2d81ca1b/test/functions/coerce.js#L33-L117
	t.Run("coerce to valid", func(t *testing.T) {
		tcs := []struct {
			in         string
			want       string
			coerceOpts semverOpts
		}{
			// [parse('1.2.3'), '1.2.3'],
			// Not applicable because function signature insists on string input.
			// ['.1', '1.0.0'],
			{".1", "1.0.0", semverOpts{}},
			// ['.1.', '1.0.0'],
			{".1.", "1.0.0", semverOpts{}},
			// ['..1', '1.0.0'],
			{"..1", "1.0.0", semverOpts{}},
			// ['.1.1', '1.1.0'],
			{".1.1", "1.1.0", semverOpts{}},
			// ['1.', '1.0.0'],
			{"1.", "1.0.0", semverOpts{}},
			// ['1.0', '1.0.0'],
			{"1.0", "1.0.0", semverOpts{}},
			// ['1.0.0', '1.0.0'],
			{"1.0.0", "1.0.0", semverOpts{}},
			// ['0', '0.0.0'],
			{"0", "0.0.0", semverOpts{}},
			// ['0.0', '0.0.0'],
			{"0.0", "0.0.0", semverOpts{}},
			// ['0.0.0', '0.0.0'],
			{"0.0.0", "0.0.0", semverOpts{}},
			// ['0.1', '0.1.0'],
			{"0.1", "0.1.0", semverOpts{}},
			// ['0.0.1', '0.0.1'],
			{"0.0.1", "0.0.1", semverOpts{}},
			// ['0.1.1', '0.1.1'],
			{"0.1.1", "0.1.1", semverOpts{}},
			// ['1', '1.0.0'],
			{"1", "1.0.0", semverOpts{}},
			// ['1.2', '1.2.0'],
			{"1.2", "1.2.0", semverOpts{}},
			// ['1.2.3', '1.2.3'],
			{"1.2.3", "1.2.3", semverOpts{}},
			// ['1.2.3.4', '1.2.3'],
			{"1.2.3.4", "1.2.3", semverOpts{}},
			// ['13', '13.0.0'],
			{"13", "13.0.0", semverOpts{}},
			// ['35.12', '35.12.0'],
			{"35.12", "35.12.0", semverOpts{}},
			// ['35.12.18', '35.12.18'],
			{"35.12.18", "35.12.18", semverOpts{}},
			// ['35.12.18.24', '35.12.18'],
			{"35.12.18.24", "35.12.18", semverOpts{}},
			// ['v1', '1.0.0'],
			{"v1", "1.0.0", semverOpts{}},
			// ['v1.2', '1.2.0'],
			{"v1.2", "1.2.0", semverOpts{}},
			// ['v1.2.3', '1.2.3'],
			{"v1.2.3", "1.2.3", semverOpts{}},
			// ['v1.2.3.4', '1.2.3'],
			{"v1.2.3.4", "1.2.3", semverOpts{}},
			// [' 1', '1.0.0'],
			{" 1", "1.0.0", semverOpts{}},
			// ['1 ', '1.0.0'],
			{"1 ", "1.0.0", semverOpts{}},
			// ['1 0', '1.0.0'],
			{"1 0", "1.0.0", semverOpts{}},
			// ['1 1', '1.0.0'],
			{"1 1", "1.0.0", semverOpts{}},
			// ['1.1 1', '1.1.0'],
			{"1.1 1", "1.1.0", semverOpts{}},
			// ['1.1-1', '1.1.0'],
			{"1.1-1", "1.1.0", semverOpts{}},
			// ['1.1-1', '1.1.0'],
			{"1.1-1", "1.1.0", semverOpts{}},
			// ['a1', '1.0.0'],
			{"a1", "1.0.0", semverOpts{}},
			// ['a1a', '1.0.0'],
			{"a1a", "1.0.0", semverOpts{}},
			// ['1a', '1.0.0'],
			{"1a", "1.0.0", semverOpts{}},
			// ['version 1', '1.0.0'],
			{"version 1", "1.0.0", semverOpts{}},
			// ['version1', '1.0.0'],
			{"version1", "1.0.0", semverOpts{}},
			// ['version1.0', '1.0.0'],
			{"version1.0", "1.0.0", semverOpts{}},
			// ['version1.1', '1.1.0'],
			{"version1.1", "1.1.0", semverOpts{}},
			// ['42.6.7.9.3-alpha', '42.6.7'],
			{"42.6.7.9.3-alpha", "42.6.7", semverOpts{}},
			// ['v2', '2.0.0'],
			{"v2", "2.0.0", semverOpts{}},
			// ['v3.4 replaces v3.3.1', '3.4.0'],
			{"v3.4 replaces v3.3.1", "3.4.0", semverOpts{}},
			// ['4.6.3.9.2-alpha2', '4.6.3'],
			{"4.6.3.9.2-alpha2", "4.6.3", semverOpts{}},
			// [`${'1'.repeat(17)}.2`, '2.0.0'],
			{strings.Repeat("1", 17) + ".2", "2.0.0", semverOpts{}},
			// [`${'1'.repeat(17)}.2.3`, '2.3.0'],
			{strings.Repeat("1", 17) + ".2.3", "2.3.0", semverOpts{}},
			// [`1.${'2'.repeat(17)}.3`, '1.0.0'],
			{"1." + strings.Repeat("2", 17) + ".3", "1.0.0", semverOpts{}},
			// [`1.2.${'3'.repeat(17)}`, '1.2.0'],
			{"1.2." + strings.Repeat("3", 17), "1.2.0", semverOpts{}},
			// [`${'1'.repeat(17)}.2.3.4`, '2.3.4'],
			{strings.Repeat("1", 17) + ".2.3.4", "2.3.4", semverOpts{}},
			// [`1.${'2'.repeat(17)}.3.4`, '1.0.0'],
			{"1." + strings.Repeat("2", 17) + ".3.4", "1.0.0", semverOpts{}},
			// [`1.2.${'3'.repeat(17)}.4`, '1.2.0'],
			{"1.2." + strings.Repeat("3", 17) + ".4", "1.2.0", semverOpts{}},
			// [`${'1'.repeat(17)}.${'2'.repeat(16)}.${'3'.repeat(16)}`,
			//   `${'2'.repeat(16)}.${'3'.repeat(16)}.0`],
			{
				fmt.Sprintf("%s.%s.%s",
					strings.Repeat("1", 17),
					strings.Repeat("2", 16),
					strings.Repeat("3", 16)),
				fmt.Sprintf("%s.%s.0",
					strings.Repeat("2", 16),
					strings.Repeat("3", 16)),
				semverOpts{},
			},
			// [`${'1'.repeat(16)}.${'2'.repeat(17)}.${'3'.repeat(16)}`,
			//   `${'1'.repeat(16)}.0.0`],
			{
				fmt.Sprintf("%s.%s.%s",
					strings.Repeat("1", 16),
					strings.Repeat("2", 17),
					strings.Repeat("3", 16)),
				strings.Repeat("1", 16) + ".0.0",
				semverOpts{},
			},
			// [`${'1'.repeat(16)}.${'2'.repeat(16)}.${'3'.repeat(17)}`,
			//   `${'1'.repeat(16)}.${'2'.repeat(16)}.0`],
			{
				fmt.Sprintf("%s.%s.%s",
					strings.Repeat("1", 16),
					strings.Repeat("2", 16),
					strings.Repeat("3", 17)),
				fmt.Sprintf("%s.%s.0",
					strings.Repeat("1", 16),
					strings.Repeat("2", 16)),
				semverOpts{},
			},
			// [`11${'.1'.repeat(126)}`, '11.1.1'],
			{"11" + strings.Repeat(".1", 128), "11.1.1", semverOpts{}},
			// ['1'.repeat(16), `${'1'.repeat(16)}.0.0`],
			{strings.Repeat("1", 16), strings.Repeat("1", 16) + ".0.0", semverOpts{}},
			// [`a${'1'.repeat(16)}`, `${'1'.repeat(16)}.0.0`],
			{"a" + strings.Repeat("1", 16), strings.Repeat("1", 16) + ".0.0", semverOpts{}},
			// [`${'1'.repeat(16)}.2.3.4`, `${'1'.repeat(16)}.2.3`],
			{strings.Repeat("1", 16) + ".2.3.4", strings.Repeat("1", 16) + ".2.3", semverOpts{}},
			// [`1.${'2'.repeat(16)}.3.4`, `1.${'2'.repeat(16)}.3`],
			{"1." + strings.Repeat("2", 16) + ".3.4", "1." + strings.Repeat("2", 16) + ".3", semverOpts{}},
			// [`1.2.${'3'.repeat(16)}.4`, `1.2.${'3'.repeat(16)}`],
			{"1.2." + strings.Repeat("3", 16) + ".4", "1.2." + strings.Repeat("3", 16), semverOpts{}},
			// [`${'1'.repeat(16)}.${'2'.repeat(16)}.${'3'.repeat(16)}`,
			//   `${'1'.repeat(16)}.${'2'.repeat(16)}.${'3'.repeat(16)}`],
			{
				fmt.Sprintf("%s.%s.%s",
					strings.Repeat("1", 16),
					strings.Repeat("2", 16),
					strings.Repeat("3", 16)),
				fmt.Sprintf("%s.%s.%s",
					strings.Repeat("1", 16),
					strings.Repeat("2", 16),
					strings.Repeat("3", 16)),
				semverOpts{},
			},
			// [`1.2.3.${'4'.repeat(252)}.5`, '1.2.3'],
			{"1.2.3." + strings.Repeat("4", 252) + ".5", "1.2.3", semverOpts{}},
			// [`1.2.3.${'4'.repeat(1024)}`, '1.2.3'],
			{"1.2.3." + strings.Repeat("4", 1024), "1.2.3", semverOpts{}},
			// [`${'1'.repeat(17)}.4.7.4`, '4.7.4'],
			{strings.Repeat("1", 17) + ".4.7.4", "4.7.4", semverOpts{}},
			// [10, '10.0.0'],
			// Not applicable because function signature insists on string input.
			// ['1.2.3/a/b/c/2.3.4', '2.3.4', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4.5.6', '4.5.6', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4.5/6', '6.0.0', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4./6', '6.0.0', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4/6', '6.0.0', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3./6', '6.0.0', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3/6', '6.0.0', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4', '2.3.4', { rtl: true }],
			// Right-to-left matching is not implemented.
			// ['1.2.3.4xyz', '2.3.4', { rtl: true }],
			// Right-to-left matching is not implemented.
		}
		for _, tc := range tcs {
			got, err := coerce(tc.in, tc.coerceOpts)
			if err != nil {
				t.Errorf("Unexpected error coercing version %q: %v", tc.in, err)
			}
			if got != tc.want {
				t.Errorf("Unexpected output coercing version %q: wanted %q, got %q", tc.in, tc.want, got)
			}
		}
	})
}
