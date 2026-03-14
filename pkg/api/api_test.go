package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/open-feature/go-sdk/openfeature"
	ofttesting "github.com/open-feature/go-sdk/openfeature/testing"
)

var (
	provider = ofttesting.NewTestProvider()
)

func TestMain(m *testing.M) {
	if err := openfeature.SetProvider(provider); err != nil {
		panic(err)
	}
	testsuite.Run(m)
}
