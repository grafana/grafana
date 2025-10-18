package secret

import "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

// InlineSecureValueSupport allows resources to manage secrets inline
//
//go:generate mockery --name InlineSecureValueSupport --structname MockInlineSecureValueSupport --inpackage --filename inline_mock.go --with-expecter
type InlineSecureValueSupport = contracts.InlineSecureValueSupport
