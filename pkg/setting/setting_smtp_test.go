package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestEmailTheme(t *testing.T) {
	testCases := []struct {
		name          string
		iniContent    string
		expectedTheme string
	}{
		{
			name:          "default theme when no theme provided",
			iniContent:    "",
			expectedTheme: darkTheme,
		},
		{
			name:          "default theme when invalid theme provided",
			iniContent:    "[emails]\ntheme=red",
			expectedTheme: darkTheme,
		},
		{
			name:          "light theme when light theme provided",
			iniContent:    "[emails]\ntheme=light",
			expectedTheme: lightTheme,
		},
		{
			name:          "dark theme when dark theme provided",
			iniContent:    "[emails]\ntheme=dark",
			expectedTheme: darkTheme,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, _ := ini.Load([]byte(tc.iniContent))
			emailSection := cfg.Section("emails")
			actualTheme := emailTheme(emailSection)
			require.Equal(t, tc.expectedTheme, actualTheme)
		})
	}
}
