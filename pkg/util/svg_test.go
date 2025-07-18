package util_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/util"
)

func TestIsSvg(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		input    string
		expected bool
	}{
		"empty":                           {"", false},
		"html page":                       {"<html><head></head><body></body></html>", false},
		"html page with DOCTYPE":          {"<!DOCTYPE html><html><head></head><body></body></html>", false},
		"empty svg":                       {"<svg></svg>", true},
		"svg with attributes":             {"<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\"></svg>", true},
		"svg with content":                {"<svg><circle cx=\"50\" cy=\"50\" r=\"40\" stroke=\"black\" stroke-width=\"2\" fill=\"red\" /></svg>", true},
		"svg with attributes and content": {"<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\"><circle cx=\"50\" cy=\"50\" r=\"40\" stroke=\"black\" stroke-width=\"2\" fill=\"red\" /></svg>", true},
		"svg with comments":               {"<svg><!-- comment --></svg>", true},
		"svg with doctype":                {"<!DOCTYPE svg><svg></svg>", true},
		"svg with xml declaration":        {"<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg></svg>", true},
		"realistic svg": {`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100" height="100">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="red" />
  <text x="50" y="50" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Hello</text>
</svg>`, true},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			result := util.IsSVG([]byte(test.input))
			if result != test.expected {
				t.Errorf("expected IsSVG to return %v, got %v", test.expected, result)
			}
		})
	}
}
