package packaging_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/packaging"
)

func TestPackageRegexp(t *testing.T) {
	t.Run("It should match enterprise2 packages", func(t *testing.T) {
		rgx := packaging.PackageRegexp(config.EditionEnterprise2)
		matches := []string{
			"grafana-enterprise2-1.2.3-4567pre.linux-amd64.tar.gz",
			"grafana-enterprise2-1.2.3-4567pre.linux-amd64.tar.gz.sha256",
		}
		for _, v := range matches {
			assert.Truef(t, rgx.MatchString(v), "'%s' should match regex '%s'", v, rgx.String())
		}
	})
}
