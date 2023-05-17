package common

// TeamDTO represents the team status and associated permissions
TeamDTO: {
    // OrgId is the ID of an organisation the team belongs to.
    orgId: int64
    // Name of the team.
    name: string
    // Email of the team.
    email?: string
    // AvatarUrl is the team's avatar URL.
    avatarUrl?: string 
    // MemberCount is the number of the team members.
    memberCount: int64
    permission: #TeamPermissionLevel 
    // AccessControl metadata associated with a given resource.
    accessControl?: {
        [string]: bool 
    }
} @cuetsy(kind="interface")

#TeamPermissionLevel: 0 | 1 | 2 | 4 @cuetsy(kind="enum",memberNames="Member|Viewer|Editor|Admin")