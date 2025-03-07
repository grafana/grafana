# API Structure

## Overview

All new Grafana APIs follow this standardized format:

```
/apis/<group>/<version>/namespaces/<namespace>/<kind>
```

## Path Components

### Group
- Represents a collection of related functionality
- Example: `dashboard.grafana.app`

### Version
The API version follows three stability levels:

| Level | Format    | Description |
|-------|-----------|-------------|
| Alpha | `v1alpha1`| Early development stage. Unstable, may contain bugs, and subject to removal |
| Beta  | `v1beta1` | Testing phase. More stable than alpha, but may still change |
| GA    | `v1`      | Generally Available. Stable with backward compatibility guarantees |

### Namespace
The namespace varies depending on your Grafana deployment:

#### OSS & On-Premise Grafana
- Single org: `default`
- Multiple orgs: `org-<org_id>`

#### Grafana Cloud
- Format: `stacks-<stack_id>`
- The `stack_id` is your instance ID on grafana.com
- Can be found on grafana.com or is automatically populated in `/swagger`

### Kind
Represents the core resource you want to interact with, such as:
- `dashboards`
- `playlists`
- `folders`

## Example

Creating a new dashboard:

`POST /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards`
