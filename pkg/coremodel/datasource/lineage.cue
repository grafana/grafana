package datasource

import "github.com/grafana/thema"

thema.#Lineage
name: "datasource"
seqs: [
    {
        schemas: [
            { // 0.0
                name: string
                type: string
                access: *"proxy" | "direct"
                url?: string
                password: string
                user: string
                database?: string
                // no longer used, now in secureJsonData
//                basicAuth: bool
//                basicAuthUser: string
//                basicAuthPassword: string
                withCredentials: bool | *false
                isDefault: bool | *false
                jsonData?: [string]: _
                secureJsonData?: [string]: bytes
                readOnly: bool | *false

                // Below fields should(?) be kept in metadata

                version: int32
                orgId: int64
                id?: int64 // TODO sequential ids are to be removed
                uid: string
                //uid: =~"^[A-Za-z][A-Za-z0-9\.-]{251}[A-Za-z]$"
            },
        ]
    },
]
