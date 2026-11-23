package fixture

import (
	"fmt"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	scenario := os.Getenv("COMPAT_TEST_SCENARIO")
	if os.Getenv("GRAFANA_COMPAT_PRINT_OWNERS") == "1" {
		if scenario == "unknown-owner" {
			fmt.Fprintln(os.Stderr, "fixture: no CODEOWNERS entry")
			os.Exit(1)
		}
		fmt.Println("@example/compat")
		return
	}
	code := m.Run()
	if scenario != "pass" {
		os.Exit(7)
	}
	os.Exit(code)
}

func TestCompatSetup(t *testing.T) {}
