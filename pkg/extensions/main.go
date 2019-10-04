package extensions

import (
	// Upgrade ldapsync from cron to cron.v3 and
	// remove the cron (v1) dependency

	_ "github.com/crewjam/saml"
	_ "github.com/gobwas/glob"
	_ "github.com/jung-kurt/gofpdf"
	_ "github.com/robfig/cron"
	_ "github.com/robfig/cron/v3"
	_ "github.com/stretchr/testify/require"
	_ "gopkg.in/square/go-jose.v2"
)

var IsEnterprise bool = false
