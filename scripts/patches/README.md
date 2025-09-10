# OpenAPI Spec Patches

This directory contains patches that are applied to OpenAPI specifications during processing to narrow types and improve TypeScript code generation.

Uses [JSON Patch (RFC 6902)](https://tools.ietf.org/html/rfc6902) format for precise and standardized modifications.

## Structure

- `types.ts` - TypeScript interfaces for patch definitions
- `openapi-patches.ts` - The main patches configuration file

## How to Add a New Patch

1. Open `openapi-patches.ts`
2. Find the appropriate spec file key (filename without `.json` extension)
3. Add a new `SchemaPatch` object with:
   - `operations`: Array of JSON Patch operations
   - `description`: Human-readable description of what the patch does

### JSON Patch Operations

- `"add"`: Add a new property
- `"replace"`: Replace an existing property value
- `"remove"`: Remove a property
- `"copy"`: Copy a value from one location to another
- `"move"`: Move a value from one location to another
- `"test"`: Test that a value at a path equals a specific value

### Example

```typescript
{
  operations: [
    { op: 'replace', path: '/components/schemas/MyType/properties/status/type', value: 'string' },
    { op: 'add', path: '/components/schemas/MyType/properties/status/enum', value: ['active', 'inactive'] }
  ],
  description: 'Narrow MyType.status to specific values'
}
```

**Important**: JSON Patch paths use `/` as separators (not `.`) and must start with `/`.

## Current Patches

### notifications.alerting.grafana.app-v0alpha1

1. **RoutingTreeMatcher.type** - Narrows the `type` field from `string` to specific matcher operators: `'=' | '!=' | '=~' | '!~'`
2. **ReceiverIntegration.settings** - Makes the `settings` field explicitly `Record<string, unknown>` with `additionalProperties: true`

## How It Works

The patches are applied during the OpenAPI spec processing pipeline:

1. The spec is processed for Kubernetes metadata cleanup
2. Schema names are simplified
3. JSON Patches are applied based on the filename using `fast-json-patch`
4. The patched spec is written to the output directory

Each patch group is applied atomically - either all operations in a group succeed or none do. This ensures consistency and prevents partially applied patches.
