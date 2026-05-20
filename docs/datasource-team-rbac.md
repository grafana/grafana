---
title: Data Source Team-Based Access Control
description: Restrict data source access based on team membership and permission levels
weight: 100
---

# Data Source Team-Based Access Control

Learn how to restrict data source access to specific teams and permission levels within your organization.

## Overview

Data source team-based access control allows administrators to limit which users can access certain data sources based on their team membership and permission level within that team. This provides granular control over data access across different teams in your organization.

## How It Works

Each data source can have optional access restrictions configured via the `allowedTeams` field. The format supports two permission levels per team:

- **Admin** - Only members with Admin permission in the team can access
- **Member** - Any member of the team can access (default if permission omitted)

### Format

The `allowedTeams` field uses a comma-separated format: `teamID:permission`

Examples:
- `1:Admin` - Team 1 members with Admin permission only
- `2:Member` - All members of Team 2
- `1:Admin,2:Member` - Team 1 admins OR Team 2 members

## Configuration

### Database Schema

The `data_source` table includes two restriction columns:

| Column | Type | Description |
|--------|------|-------------|
| `allowed_teams` | VARCHAR(255) | Comma-separated team:permission pairs |
| `allowed_roles` | VARCHAR(255) | Comma-separated org roles (Admin/Editor/Viewer) |

### Backend Implementation

**Key Files:**
- `pkg/services/datasources/models.go` - DataSource model with `AllowedTeams`, `AllowedRoles` fields
- `pkg/services/datasources/guardian/allow_guardian.go` - Team-based guardian implementation
- `pkg/services/sqlstore/migrations/datasource_mig.go` - Database migrations

**Permission Check Logic (`checkTeamPermission`):**

```go
func (t *TeamBasedGuardian) checkTeamPermission(ds *datasources.DataSource, memberships []*team.TeamMemberDTO) bool {
    rules := ds.ParseAllowedTeams()
    if len(rules) == 0 {
        return true  // No restrictions
    }
    for _, membership := range memberships {
        for _, rule := range rules {
            if membership.TeamID == rule.TeamID {
                if membership.Permission == team.PermissionTypeAdmin && rule.Permission == datasources.TeamPermissionAdmin {
                    return true
                }
                if membership.Permission == team.PermissionTypeMember && rule.Permission == datasources.TeamPermissionMember {
                    return true
                }
            }
        }
    }
    return false
}
```

### API Endpoints

**Get Data Sources (filtered by permissions):**
```
GET /api/datasources
```

**Create Data Source:**
```
POST /api/datasources
```

**Update Data Source:**
```
PUT /api/datasources/uid/:uid
```

Both create and update endpoints accept `allowedTeams` and `allowedRoles` in the request body.

## Use Cases

### Team-Specific Data Sources

Limit a production Prometheus instance to only the SRE team:

```
allowedTeams: "3:Member"
```

Where Team 3 is the SRE team.

### Multi-Team Access with Different Permissions

Allow only team leads (team admins) to access a sensitive financial data source:

```
allowedTeams: "1:Admin,2:Admin"
```

### Combined Team and Role Restrictions

Restrict access to users who are both in a specific team AND have a certain org role:

```
allowedTeams: "5:Admin"
allowedRoles: "Admin,Editor"
```

This requires BOTH conditions to be met (AND logic).

## Example Scenarios

| allowedTeams | User Team Membership | User Permission in Team | Access Result |
|--------------|---------------------|-------------------------|---------------|
| `1:Admin` | Team 1 | Admin | ✅ Allowed |
| `1:Admin` | Team 1 | Member | ❌ Denied |
| `1:Admin` | Team 2 | Admin | ❌ Denied |
| `1:Member` | Team 1 | Member | ✅ Allowed |
| `1:Member` | Team 1 | Admin | ✅ Allowed |
| `2:Member` | Team 1 | Member | ❌ Denied |
| `1:Admin,2:Member` | Team 1 | Admin | ✅ Allowed |
| `1:Admin,2:Member` | Team 2 | Member | ✅ Allowed |
| `1:Admin,2:Member` | Team 3 | Member | ❌ Denied |

## Migration

Database migrations are included in `pkg/services/sqlstore/migrations/datasource_mig.go` to add the `allowed_teams` and `allowed_roles` columns to the `data_source` table.

To manually verify the columns exist:

```sql
SELECT id, name, allowed_teams, allowed_roles FROM data_source;
```

## Limitations

- Superadmin users bypass all team-based restrictions
- If `allowedTeams` is empty, all authenticated users can access the data source
- Legacy format (team ID only, no permission) defaults to Member permission for backward compatibility

## Related

- [Data Sources API Documentation](/docs/grafana/latest/administration/data-source-management/)
- [Team Management](/docs/grafana/latest/administration/team-management/)
- [Role-Based Access Control](/docs/grafana/latest/administration/roles-and-permissions/)