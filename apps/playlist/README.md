# Playlist API

This document provides examples of how to interact with the Playlist API using curl commands.

## Prerequisites

- Grafana server running (default: http://localhost:3000)
- Valid authentication credentials (using `admin:admin` in examples)

## API Endpoints

All playlist operations use the Kubernetes-style API endpoints: `/apis/playlist.grafana.app/v0alpha1/`

## List Operations

### List all playlists

```bash
curl -X GET http://localhost:3000/apis/playlist.grafana.app/v0alpha1/playlists \
  -u admin:admin \
  -H "Accept: application/json"
```

### List playlists in a specific namespace

```bash
curl -X GET http://localhost:3000/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists \
  -u admin:admin \
  -H "Accept: application/json"
```

## Get Operations

### Get a specific playlist by name

```bash
curl -X GET http://localhost:3000/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists/YOUR_PLAYLIST_NAME \
  -u admin:admin \
  -H "Accept: application/json"
```

## Create Operations

### Create a new playlist

```bash
curl -X POST http://localhost:3000/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "playlist.grafana.app/v0alpha1",
    "kind": "Playlist",
    "metadata": {
      "name": "my-playlist",
      "namespace": "default"
    },
    "spec": {
      "title": "My Playlist",
      "interval": "30s",
      "items": [
        {
          "type": "dashboard_by_uid",
          "value": "dashboard-uid-1"
        }
      ]
    }
  }'
```

## Update Operations

### Update a playlist

```bash
curl -X PUT http://localhost:3000/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists/my-playlist \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "apiVersion": "playlist.grafana.app/v0alpha1",
    "kind": "Playlist",
    "metadata": {
      "name": "my-playlist",
      "namespace": "default"
    },
    "spec": {
      "title": "Updated Playlist",
      "interval": "60s",
      "items": [
        {
          "type": "dashboard_by_uid",
          "value": "dashboard-uid-1"
        }
      ]
    }
  }'
```

## Delete Operations

### Delete a playlist

```bash
curl -X DELETE http://localhost:3000/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists/my-playlist \
  -u admin:admin \
  -H "Accept: application/json"
```

## Playlist Item Types

When creating or updating playlists, the `items` array supports the following types:

- `dashboard_by_uid`: Reference a dashboard by its UID
- `dashboard_by_tag`: Reference dashboards by tag
- `dashboard_by_id`: Reference a dashboard by ID (deprecated)

## Example Playlist Spec

```json
{
  "title": "My Playlist",
  "interval": "30s",
  "items": [
    {
      "type": "dashboard_by_uid",
      "value": "dashboard-uid-1"
    },
    {
      "type": "dashboard_by_tag",
      "value": "monitoring"
    }
  ]
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

#### List All Playlists (Full Details)

```graphql
query GetPlaylists {
  playlists(namespace: "default") {
    items {
      metadata {
        name
        namespace
        creationTimestamp
      }
      uid
      name
      interval
      items {
        id
        playlistUid
        type
        value
        order
        title
      }
    }
  }
}
```

#### List All Playlists (Basic Info Only)

```graphql
query GetPlaylists {
  playlists(namespace: "default") {
    items {
      metadata {
        name
      }
      uid
      name
      interval
    }
  }
}
```

#### Get Single Playlist

```graphql
query GetPlaylist {
  playlist(namespace: "default", name: "my-playlist") {
    metadata {
      name
    }
    uid
    name
    interval
  }
}
```

### Available GraphQL Fields

You can query these fields on a playlist:

- `metadata` (standard Kubernetes metadata)
- `uid` (playlist unique identifier)
- `name` (playlist title/name)
- `interval` (time between dashboard switches)
- `items` (array of playlist items with: `id`, `playlistUid`, `type`, `value`, `order`, `title`)

### GraphQL via curl

#### List all playlists via GraphQL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetPlaylists { playlists(namespace: \"default\") { items { metadata { name namespace creationTimestamp } uid name interval items { id playlistUid type value order title } } } }"
  }'
```

#### Get specific playlist information via GraphQL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetPlaylist { playlist(namespace: \"default\", name: \"my-playlist\") { metadata { name } uid name interval } }"
  }'
```

#### Basic playlist query

```bash
curl -X POST http://localhost:3000/api/graphql \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetPlaylists { playlists(namespace: \"default\") { items { metadata { name } uid name interval } } }"
  }'
```

## Response Format

All responses follow the Kubernetes API conventions and return JSON objects with:

- `apiVersion`: The API version
- `kind`: The resource type ("Playlist" or "PlaylistList")
- `metadata`: Standard Kubernetes metadata
- `spec`: The playlist specification
- `status`: The playlist status (if applicable)
