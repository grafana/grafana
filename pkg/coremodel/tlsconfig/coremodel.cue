package tlsconfig

import "github.com/grafana/thema"

thema.#Lineage
name: "tlsconfig"
seqs: [
	{
		schemas: [
			{
				// The CA cert to use for the targets.
				ca_file?: string

				// The client cert file for the targets.
				cert_file?: string

				// Disable target certificate validation.
				insecure_skip_verify?: bool

				// The client key file for the targets.
				key_file?: string

				// Used to verify the hostname for the targets.
				server_name?: string
			},
		]
	},
]
