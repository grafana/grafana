package v1beta1

// Shapes shared by more than one integration, written once here rather than
// repeated in every integration file.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#Authorization: {
	type?: string
}

#BasicAuth: {
	username?: string
}

#GrafanaTLSConfig: {
	insecureSkipVerify?: bool
}

#HTTPClientConfig: {
	basic_auth?:       #BasicAuth
	authorization?:    #Authorization
	follow_redirects?: bool
	enable_http2?:     bool
	http_headers?: {
		[string]: string
	}
	proxy_url?:              string
	no_proxy?:               string
	proxy_from_environment?: bool
	proxy_connect_header?: {
		[string]: string
	}
	tls_config?: #TLSConfig
	oauth2?:     #OAuth2
}

#OAuth2: {
	client_id: string
	token_url: string
	scopes?:   string
	endpoint_params?: {
		[string]: string
	}
	tls_config?:             #TLSConfig
	proxy_url?:              string
	no_proxy?:               string
	proxy_from_environment?: bool
	proxy_connect_header?: {
		[string]: string
	}
}

#Sigv4: {
	region?:   string
	profile?:  string
	role_arn?: string
}

#TLSConfig: {
	server_name?:          string
	insecure_skip_verify?: bool
	min_version?:          string
	max_version?:          string
}
