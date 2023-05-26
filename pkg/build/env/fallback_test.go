package env

import (
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

const (
	flag1 = "flag1"
	flag2 = "flag2"
)

func TestRequireListWithEnvFallback(t *testing.T) {
	var app = cli.NewApp()
	tests := []struct {
		testName    string
		ctx         *cli.Context
		name        string
		envName     string
		expected    []string
		expectedErr error
	}{
		{
			testName:    "string slice present in context",
			ctx:         cli.NewContext(app, applyFlagSet(t, flag1, "a"), nil),
			name:        flag1,
			envName:     "",
			expected:    []string{"a"},
			expectedErr: nil,
		},
		{
			testName:    "string slice present in env",
			ctx:         cli.NewContext(app, flag.NewFlagSet("test", 0), nil),
			name:        flag1,
			envName:     setEnv(t, flag1, "a"),
			expected:    []string{"a"},
			expectedErr: nil,
		},
		{
			testName:    "string slice absent in both context and env",
			ctx:         cli.NewContext(app, flag.NewFlagSet("test", 0), nil),
			name:        flag1,
			envName:     "",
			expected:    []string(nil),
			expectedErr: cli.Exit("Required flag (flag1) or environment variable () not set", 1),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flagList, err := RequireListWithEnvFallback(tt.ctx, tt.name, tt.envName)
			if tt.expectedErr != nil {
				require.Error(t, err)
			}
			require.Equal(t, tt.expected, flagList)
		})
	}
}

func TestRequireStringWithEnvFallback(t *testing.T) {
	var app = cli.NewApp()
	tests := []struct {
		testName    string
		ctx         *cli.Context
		name        string
		envName     string
		expected    string
		expectedErr error
	}{
		{
			testName:    "string present in the context",
			ctx:         cli.NewContext(app, setFlags(t, flag1, flag2, flag.NewFlagSet("test", flag.ContinueOnError)), nil),
			name:        flag1,
			envName:     "",
			expected:    "a",
			expectedErr: nil,
		},
		{
			testName:    "string present in env",
			ctx:         cli.NewContext(app, setFlags(t, "", "", flag.NewFlagSet("test", flag.ContinueOnError)), nil),
			name:        flag1,
			envName:     setEnv(t, flag1, "a"),
			expected:    "a",
			expectedErr: nil,
		},
		{
			testName:    "string absent from both context and env",
			ctx:         cli.NewContext(app, setFlags(t, "", flag2, flag.NewFlagSet("test", flag.ContinueOnError)), nil),
			name:        flag1,
			envName:     "",
			expected:    "",
			expectedErr: cli.Exit("Required flag (flag1) or environment variable () not set", 1),
		},
	}
	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			flagString, err := RequireStringWithEnvFallback(tt.ctx, tt.name, tt.envName)
			if tt.expectedErr != nil {
				require.Error(t, err)
			}
			require.Equal(t, tt.expected, flagString)
		})
	}
}

func applyFlagSet(t *testing.T, aFlag, aValue string) *flag.FlagSet {
	t.Helper()
	var val cli.StringSlice
	fl := cli.StringSliceFlag{Name: aFlag, EnvVars: []string{"FLAG"}, Value: &val}
	set := flag.NewFlagSet("test", 0)
	parseInput := []string{fmt.Sprintf("-%s", aFlag), aValue}
	err := fl.Apply(set)
	require.NoError(t, err)
	err = set.Parse(parseInput)
	require.NoError(t, err)
	return set
}

func setFlags(t *testing.T, flag1, flag2 string, flagSet *flag.FlagSet) *flag.FlagSet {
	t.Helper()
	if flag1 != "" {
		flagSet.StringVar(&flag1, "flag1", "a", "")
	}
	if flag2 != "" {
		flagSet.StringVar(&flag2, "flag2", "b", "")
	}
	return flagSet
}

func setEnv(t *testing.T, key, value string) string {
	t.Helper()
	os.Clearenv()

	err := os.Setenv(key, value)
	if err != nil {
		require.NoError(t, err)
	}
	return key
}
