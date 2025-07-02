# Investigation API

This document provides examples of how to interact with the Investigation API using curl commands.

## Prerequisites

- Grafana server running (default: http://localhost:3000)
- Valid authentication credentials (using `admin:admin` in examples)

## API Endpoints

All investigation operations use the Kubernetes-style API endpoints: `/apis/investigations.grafana.app/v0alpha1/`

## List Operations

### List all investigations

```bash
curl -X GET http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations \
  -u admin:admin \
  -H "Accept: application/json"
```

### List investigations in a specific namespace

```bash
curl -X GET http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations \
  -u admin:admin \
  -H "Accept: application/json"
```

## Get Operations

### Get a specific investigation by name

```bash
curl -X GET http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations/YOUR_INVESTIGATION_NAME \
  -u admin:admin \
  -H "Accept: application/json"
```

## Create Operations

### Create a new investigation

```bash
curl -X POST http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "investigations.grafana.app/v0alpha1",
    "kind": "Investigation",
    "metadata": {
      "name": "my-investigation",
      "namespace": "default"
    },
    "spec": {
      "title": "My Investigation",
      "createdByProfile": {
        "uid": "user-123",
        "name": "John Doe",
        "gravatarUrl": "https://www.gravatar.com/avatar/example"
      },
      "hasCustomName": true,
      "isFavorite": false,
      "overviewNote": "This investigation tracks system performance issues",
      "overviewNoteUpdatedAt": "2024-01-01T12:00:00Z",
      "collectables": [
        {
          "id": "collect-1",
          "createdAt": "2024-01-01T10:00:00Z",
          "title": "CPU Usage Panel",
          "origin": "dashboard",
          "type": "panel",
          "queries": ["cpu_usage_percent"],
          "timeRange": {
            "from": "now-1h",
            "to": "now"
          },
          "datasource": {
            "uid": "prometheus-uid"
          },
          "url": "/d/dashboard-uid/system-metrics?panelId=1",
          "logoPath": "/public/img/prometheus_logo.svg",
          "note": "High CPU usage detected",
          "noteUpdatedAt": "2024-01-01T11:00:00Z",
          "fieldConfig": "{\"displayMode\": \"table\"}"
        }
      ],
      "viewMode": {
        "mode": "full",
        "showComments": true,
        "showTooltips": true
      }
    }
  }'
```

## Update Operations

### Update an investigation

```bash
curl -X PUT http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations/my-investigation \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "investigations.grafana.app/v0alpha1",
    "kind": "Investigation",
    "metadata": {
      "name": "my-investigation",
      "namespace": "default"
    },
    "spec": {
      "title": "Updated Investigation",
      "createdByProfile": {
        "uid": "user-123",
        "name": "John Doe",
        "gravatarUrl": "https://www.gravatar.com/avatar/example"
      },
      "hasCustomName": true,
      "isFavorite": true,
      "overviewNote": "Updated investigation notes",
      "overviewNoteUpdatedAt": "2024-01-01T15:00:00Z",
      "collectables": [],
      "viewMode": {
        "mode": "compact",
        "showComments": false,
        "showTooltips": true
      }
    }
  }'
```

## Delete Operations

### Delete an investigation

```bash
curl -X DELETE http://localhost:3000/apis/investigations.grafana.app/v0alpha1/namespaces/default/investigations/my-investigation \
  -u admin:admin \
  -H "Accept: application/json"
```

## Investigation Collectable Types

When creating or updating investigations, the `collectables` array supports the following origins and types:

- `dashboard`: Panel collectables from dashboards
- `explore`: Query collectables from Explore
- `alert`: Alert rule collectables
- Types: `panel`, `timeseries`, `table`, `stat`, `gauge`

## Example Investigation Spec

```json
{
  "title": "My Investigation",
  "createdByProfile": {
    "uid": "user-123",
    "name": "John Doe",
    "gravatarUrl": "https://www.gravatar.com/avatar/example"
  },
  "hasCustomName": true,
  "isFavorite": false,
  "overviewNote": "Investigation into system performance",
  "overviewNoteUpdatedAt": "2024-01-01T12:00:00Z",
  "collectables": [
    {
      "id": "collect-1",
      "createdAt": "2024-01-01T10:00:00Z",
      "title": "CPU Usage Panel",
      "origin": "dashboard",
      "type": "panel",
      "queries": ["cpu_usage_percent"],
      "timeRange": {
        "from": "now-1h",
        "to": "now"
      },
      "datasource": {
        "uid": "prometheus-uid"
      },
      "url": "/d/dashboard-uid/system-metrics?panelId=1",
      "note": "High CPU usage detected",
      "noteUpdatedAt": "2024-01-01T11:00:00Z",
      "fieldConfig": "{\"displayMode\": \"table\"}"
    }
  ],
  "viewMode": {
    "mode": "full",
    "showComments": true,
    "showTooltips": true
  }
}
```

## Authentication

These examples use HTTP Basic Authentication with `admin:admin`. In production environments:

- Use proper API tokens instead of basic auth
- Replace `admin:admin` with your actual credentials
- Consider using `--netrc` or environment variables for credentials

## GraphQL API (Read-Only)

**Note**: The GraphQL API currently only supports **read operations** (queries). Create, update, and delete operations via GraphQL are not yet implemented. For write operations, use the REST API endpoints above.

### GraphQL Queries

#### List All Investigations (Full Details)

```graphql
query GetInvestigations {
  investigations(namespace: "default") {
    items {
      metadata {
        name
        namespace
        creationTimestamp
      }
      title
      createdByProfile {
        uid
        name
        gravatarUrl
      }
      hasCustomName
      isFavorite
      overviewNote
      overviewNoteUpdatedAt
      viewMode {
        mode
        showComments
        showTooltips
      }
      collectables {
        id
        createdAt
        title
        origin
        type
        queries
        timeRange {
          from
          to
        }
        datasource {
          uid
        }
        url
        logoPath
        note
        noteUpdatedAt
        fieldConfig
      }
    }
  }
}
```

#### List All Investigations (Basic Info Only)

```graphql
query GetInvestigations {
  investigations(namespace: "default") {
    items {
      metadata {
        name
      }
      title
      createdByProfile {
        name
      }
      hasCustomName
      isFavorite
    }
  }
}
```

#### Get Single Investigation

```graphql
query GetInvestigation {
  investigation(namespace: "default", name: "my-investigation") {
    metadata {
      name
    }
    title
    createdByProfile {
      name
      uid
    }
    overviewNote
    collectables {
      id
      title
      origin
      type
    }
  }
}
```

### Available GraphQL Fields

You can query these fields on an investigation:

- `metadata` (standard Kubernetes metadata)
- `title` (investigation title)
- `createdByProfile` (user information with: `uid`, `name`, `gravatarUrl`)
- `hasCustomName` (boolean indicating custom title)
- `isFavorite` (boolean indicating favorite status)
- `overviewNote` (investigation notes)
- `overviewNoteUpdatedAt` (last note update timestamp)
- `viewMode` (display settings with: `mode`, `showComments`, `showTooltips`)
- `collectables` (array of collected items with: `id`, `createdAt`, `title`, `origin`, `type`, `queries`, `timeRange`, `datasource`, `url`, `logoPath`, `note`, `noteUpdatedAt`, `fieldConfig`)

### GraphQL via curl

#### List all investigations via GraphQL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetInvestigations { investigations(namespace: \"default\") { items { metadata { name namespace creationTimestamp } title createdByProfile { uid name gravatarUrl } hasCustomName isFavorite collectables { id title origin type } } } }"
  }'
```

#### Get specific investigation information via GraphQL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetInvestigation { investigation(namespace: \"default\", name: \"my-investigation\") { metadata { name } title createdByProfile { name uid } overviewNote } }"
  }'
```

#### Basic investigation query

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetInvestigations { investigations(namespace: \"default\") { items { metadata { name } title createdByProfile { name } hasCustomName isFavorite } } }"
  }'
```

## Response Format

All responses follow the Kubernetes API conventions and return JSON objects with:

- `apiVersion`: The API version
- `kind`: The resource type ("Investigation" or "InvestigationList")
- `metadata`: Standard Kubernetes metadata
- `spec`: The investigation specification
- `status`: The investigation status (if applicable)

 
