package extensions

import (
	_ "github.com/crewjam/saml"
	_ "github.com/gobwas/glob"
	_ "github.com/robfig/cron"
	_ "github.com/stretchr/testify/require"
	_ "gopkg.in/square/go-jose.v2"
)

var IsEnterprise bool = false
