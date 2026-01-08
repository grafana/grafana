package v0alpha1

ServiceAccountSpec: {
    disabled: bool |* false
    plugin: string
    role: OrgRole
    title: string
}

OrgRole: "None" | "Viewer" | "Editor" | "Admin" @cuetsy(kind="enum")
