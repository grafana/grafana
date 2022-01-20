package datasource

import "github.com/grafana/thema"

thema.#Lineage

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
                access: *"proxy" | "direct" // TODO are we sure this default is right?
                url: string
                password: string
                user: string
                database: string
                basicAuth: bool
                secureJsonFields: [string]: bool
                // TODO do the rest
            }
        ]
    },
]
