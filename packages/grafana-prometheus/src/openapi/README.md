# OpenAPI Generated Types for Prometheus API

TypeScript type definitions generated from the Prometheus OpenAPI specification.

## Files

- **`generated.d.ts`** - Auto-generated TypeScript types. DO NOT EDIT manually.

## Quick Start

### Import Types

```typescript
import type { paths, components, operations } from './openapi/gen-types';
```

### Type-Safe API Calls

```typescript
import type { paths, components } from './openapi/gen-types';

// Extract response type for metadata endpoint
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];

// Extract parameters type
type MetadataParams = paths['/metadata']['get']['parameters']['query'];

// Type-safe API call
const params: MetadataParams = {
  limit: 1000,
  metric: 'http_requests_total',
};

const response: MetadataResponse = await request('/api/v1/metadata', params);

// Access typed response data
for (const [name, metadataArray] of Object.entries(response.data)) {
  console.log(metadataArray[0].type);  // counter, gauge, etc.
  console.log(metadataArray[0].help);  // Help text
}
```

## Common Patterns

### Labels Endpoint

```typescript
import type { paths } from './openapi/gen-types';

type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
type LabelsParams = paths['/labels']['get']['parameters']['query'];

const params: LabelsParams = {
  start: timeRange.from.unix(),
  end: timeRange.to.unix(),
  'match[]': ['{job="prometheus"}'],
  limit: 1000,
};

const response: LabelsResponse = await request('/api/v1/labels', params);
console.log(response.data);  // string[]
```

### Query Endpoint

```typescript
import type { paths } from './openapi/gen-types';

type QueryResponse = paths['/query']['get']['responses']['200']['content']['application/json'];
type QueryParams = paths['/query']['get']['parameters']['query'];

const params: QueryParams = {
  query: 'up',
  time: Date.now() / 1000,
  timeout: '30s',
};

const response: QueryResponse = await request('/api/v1/query', params);
console.log(response.data.result);
```

### Using Components Schemas

```typescript
import type { components } from './openapi/gen-types';

// Reusable schema types
type Labels = components['schemas']['Labels'];
type Metadata = components['schemas']['Metadata'];
type Error = components['schemas']['Error'];

// Use in your code
function processMetadata(metadata: Metadata) {
  console.log(`Type: ${metadata.type}, Help: ${metadata.help}`);
}
```

## Regenerating Types

### From Local Spec

```bash
yarn generate-types
```

Generates types from `openapi.yaml` in the package root.

### From Remote Prometheus Server

```bash
export PROMETHEUS_URL=http://localhost:9090
yarn generate-types:remote
```

Fetches OpenAPI spec from a running Prometheus server.

## Type Aliases (Optional)

To make types easier to work with, create type aliases:

```typescript
import type { paths, components } from './openapi/gen-types';

// Create convenient aliases
export type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
export type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
export type QueryResponse = paths['/query']['get']['responses']['200']['content']['application/json'];

export type MetadataParams = paths['/metadata']['get']['parameters']['query'];
export type LabelsParams = paths['/labels']['get']['parameters']['query'];
export type QueryParams = paths['/query']['get']['parameters']['query'];

// Use aliases
const params: MetadataParams = { limit: 1000 };
const response: MetadataResponse = await request('/api/v1/metadata', params);
```

## Runtime Feature Detection

Detect API features by fetching the OpenAPI spec from Prometheus:

```typescript
async function detectAPIFeatures(baseUrl: string): Promise<Set<string>> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/openapi.yaml`);

    if (!response.ok) {
      return new Set();  // OpenAPI not available
    }

    const spec = await response.text();
    const features = new Set<string>();

    // Check for specific parameters
    if (spec.includes('lookback_delta')) {
      features.add('lookback_delta');
    }

    if (spec.includes('stats')) {
      features.add('stats');
    }

    return features;
  } catch (error) {
    return new Set();
  }
}

// Usage
const features = await detectAPIFeatures(this.url);

if (features.has('stats')) {
  // Add stats parameter to query
  params.stats = 'all';
}
```

## Best Practices

1. **Create type aliases** for frequently used types to keep code readable
2. **Check response status** - responses can be success or error
3. **Use runtime feature detection** to conditionally use new parameters
4. **Regenerate types** when Prometheus version changes

## Troubleshooting

### Types are outdated

```bash
# Regenerate from current Prometheus server
export PROMETHEUS_URL=http://localhost:9090
yarn generate-types:remote
```

### Type errors after regenerating

The Prometheus API changed. Update your code to match new parameter names or types.

### Unknown parameter errors at runtime

Your Prometheus version doesn't support that parameter. Use feature detection:

```typescript
const features = await detectAPIFeatures(this.url);

if (features.has('lookback_delta')) {
  params.lookback_delta = '5m';
}
```
