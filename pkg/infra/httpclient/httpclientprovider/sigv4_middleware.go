package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-aws-sdk/pkg/sigv4"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// SigV4MiddlewareName the middleware name used by SigV4Middleware.
const SigV4MiddlewareName = "sigv4"

var newSigV4Func = sigv4.New

// SigV4Middleware applies AWS Signature Version 4 request signing for the outgoing request.
func SigV4Middleware() httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(SigV4MiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if opts.SigV4 == nil {
			return next
		}

		return newSigV4Func(
			&sigv4.Config{
				Service:       opts.SigV4.Service,
				AccessKey:     opts.SigV4.AccessKey,
				SecretKey:     opts.SigV4.SecretKey,
				Region:        opts.SigV4.Region,
				AssumeRoleARN: opts.SigV4.AssumeRoleARN,
				AuthType:      opts.SigV4.AuthType,
				ExternalID:    opts.SigV4.ExternalID,
				Profile:       opts.SigV4.Profile,
			},
			next,
		)
	})
}
