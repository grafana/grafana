package datasource

import "github.com/grafana/thema"

thema.#Lineage
name: "datasource"
seqs: [
    {
        schemas: [
            { // 0.0
                type: string
                typeLogoUrl: string
                access: *"proxy" | "direct"
                url: string
                password: string
                user: string
                database: string
                basicAuth: bool
                basicAuthUser: string
                basicAuthPassword: string
                withCredentials: bool | *false
                isDefault: bool | *false
                jsonData: string
                version: int32
                readOnly: bool | *false
            }
        ]
    },
]
