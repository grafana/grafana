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
                //uid: string
                //orgId: int
                //name: string
                type: string
                typeLogoUrl: string
                access: *"proxy" | "direct" // TODO are we sure this default is right?
                url: string
                password: string
                user: string
                database: string
                basicAuth: bool
                basicAuthUser: string
                basicAuthPassword: string
                withCredentials: bool | *false
                isDefault: bool | *false
                jsonData?: [string]: _
                version: int32
                readOnly: bool | *false
                secureJsonFields?: [string]: bool
                accessControl?: [string]: bool
            }
        ]
    },
]
