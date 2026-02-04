# Scopes Provisioning Script

This script generates Scopes, ScopeNodes, and ScopeNavigations for Grafana development environments.

## Usage

### Create resources

```bash
# From devenv directory
./setup.sh scopes

# Or run directly
cd scopes
go run scopes.go
```

### Delete all gdev-prefixed resources

```bash
# From devenv directory
./setup.sh undev

# Or run directly
cd scopes
go run scopes.go -clean
```

**Note about caching**: The `/find/scope_navigations` endpoint used by the UI caches ScopeNavigation results for 15 minutes. After running cleanup, deleted resources may still appear in the UI until the cache expires. The resources are actually deleted (you can verify by checking the `/scopenavigations` list endpoint), but the UI will refresh after ~15 minutes or after restarting Grafana.

Doing an `Empty Cache and Hard Reload` will also help.

## Configuration

The script reads from `scopes-config.yaml` by default. You can specify a different config file:

```bash
go run scopes.go -config=my-config.yaml
```

### Configuration Format

The configuration file uses YAML format with a natural tree structure. The indentation itself represents the hierarchy:

- **scopes**: Map of scope definitions (key is the scope name)
- **tree**: Tree structure of scope nodes where the YAML structure defines parent-child relationships
- **navigations**: Map of scope navigations linking URLs to scopes (key is the navigation name)

Example:

```yaml
scopes:
  app1:
    title: Application 1
    filters:
      - key: app
        operator: equals
        value: app1

tree:
  environments:
    title: Environments
    nodeType: container
    children:
      production:
        title: Production
        nodeType: container
        children:
          app1-prod:
            title: Application 1
            nodeType: leaf
            linkId: app1
            linkType: scope

navigations:
  # Link to a dashboard
  app1-nav:
    url: /d/86Js1xRmk
    scope: app1

  # Link to another dashboard
  app2-nav:
    url: /d/GlAqcPgmz
    scope: app2

  # Custom URLs
  explore-nav:
    url: /explore
    scope: app1
```

### Tree Structure

The tree structure uses YAML's natural indentation to represent hierarchy:

- **Key**: Unique identifier for the node (will be prefixed with "gdev-")
- **title**: Display title
- **nodeType**: Either "container" (can have children) or "leaf" (selectable scope)
- **linkId**: References a scope name (if nodeType is "leaf")
- **linkType**: Usually "scope"
- **children**: Map of child nodes (nested structure follows YAML indentation)

### Node Types

- **container**: A category/grouping node that can contain other nodes
- **leaf**: A selectable node that links to a scope

### Navigations

Navigations link URLs to scopes. The `url` field should contain the full URL path (e.g., `/d/abc123` for dashboards or `/explore` for other pages).

To find dashboard UIDs from gdev dashboards:

```bash
# Find UIDs of all gdev dashboards
find devenv/dev-dashboards -name "*.json" -exec sh -c 'echo "{}:" && jq -r ".uid // .dashboard.uid // \"NO_UID\"" {}' \;

# Or for a specific dashboard
jq -r ".uid // .dashboard.uid" devenv/dev-dashboards/all-panels.json
```

## Environment Variables

- `GRAFANA_URL`: Grafana URL (default: http://localhost:3000)
- `GRAFANA_NAMESPACE`: Namespace (default: default)
- `GRAFANA_USER`: Grafana username (default: admin)
- `GRAFANA_PASSWORD`: Grafana password (default: admin)

## Command Line Flags

- `-url`: Grafana URL
- `-namespace`: Namespace
- `-config`: Config file path (default: scopes-config.yaml)
- `-user`: Grafana username
- `-password`: Grafana password
- `-clean`: Delete all gdev-prefixed resources

## Prefix

All resources are automatically prefixed with "gdev-" to avoid conflicts with production data.
