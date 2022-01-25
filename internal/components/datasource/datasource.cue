package datasource

import "github.com/grafana/thema"

thema.#Lineage
name: "datasource"
seqs: [
    {
        schemas: [
            { // 0.0
                // TODO these are all currently marked as required, but it's
                // likely that some/many/most of them aren't. This needs careful
                // attention!
                name: string
                type: string
                typeLogoUrl: string
                // access: *"proxy" | "direct" // TODO are we sure this default is right?
                access: string // FIXME doing this until sam figures out how to deal with CUE<->Go type mappings
                url: string
                password: string
                user: string
                database: string
                basicAuth: bool
                basicAuthUser: string
                basicAuthPassword: string
                //secureJsonFields: [string]: bool
                // TODO do the rest
            }
        ]
    },
]
