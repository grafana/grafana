package v0alpha1

ServiceAccountSpec: {
    avatarUrl: string
    disabled: bool |* false
    external: bool |* false
    login: string
    role: OrgRole
    title: string
}

OrgRole: "None" | "Viewer" | "Editor" | "Admin" @cuetsy(kind="enum")
