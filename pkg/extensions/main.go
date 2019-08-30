package extensions

import (
	// Need to remove "github.com/robfig/cron" with v3
	// version after it will be used everywhere

	_ "github.com/crewjam/saml"
	_ "github.com/gobwas/glob"
	_ "github.com/jung-kurt/gofpdf"
	_ "github.com/robfig/cron"
	_ "github.com/robfig/cron/v3"
	_ "github.com/stretchr/testify/require"
	_ "gopkg.in/square/go-jose.v2"
)

var IsEnterprise bool = false
