# OpenAPI Integration Guide for Prometheus Datasource

## Overview

This guide explains how to use OpenAPI-generated TypeScript types for type-safe Prometheus API interactions.

## What is OpenAPI?

**OpenAPI** (formerly Swagger) is a specification format for describing REST APIs. The Prometheus OpenAPI spec (`openapi.yaml`) defines:

- **Endpoints**: API routes like `/api/v1/query`, `/api/v1/labels`, `/api/v1/metadata`
- **Parameters**: Request parameters with types, constraints, and documentation
- **Responses**: Response schemas with exact data structures
- **Components**: Reusable schemas like `Labels`, `Metadata`, `Error`

## Why Use OpenAPI Types?

### Before (No Types)

```typescript
// ❌ No type safety
const result = await request('/api/v1/metadata', {
  limit: '1000',  // Bug! Should be number
  invalid: true   // Bug! Unknown parameter
});

// ❌ Response is 'any' - no autocomplete
result.data.forEach(...)
```

### After (With OpenAPI Types)

```typescript
import type { paths } from './openapi/gen-types';

type MetadataParams = paths['/metadata']['get']['parameters']['query'];
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];

// ✅ Type-safe parameters
const params: MetadataParams = {
  limit: 1000,  // ✅ Correct type
};

// ✅ Type-safe response
const response: MetadataResponse = await request('/api/v1/metadata', params);

// ✅ Full autocomplete
for (const [name, metadata] of Object.entries(response.data)) {
  console.log(metadata[0].type);  // counter, gauge, etc.
  console.log(metadata[0].help);  // Help text
}
```

**Benefits:**
- ✅ Catch API errors at compile-time
- ✅ IDE autocomplete for parameters and responses
- ✅ Self-documenting code
- ✅ Runtime feature detection via OpenAPI spec
- ✅ Easy updates when Prometheus API changes

## Setup

### Installation

The integration is already set up. To regenerate types:

```bash
# From local openapi.yaml
yarn generate-types

# From remote Prometheus server
export PROMETHEUS_URL=http://localhost:9090
yarn generate-types:remote
```

### Files

```
packages/grafana-prometheus/
├── openapi.yaml                    # OpenAPI specification (source)
├── src/
│   └── openapi/
│       ├── generated.d.ts          # Generated TypeScript types
│       └── README.md               # Quick reference
└── docs/
    └── OPENAPI_INTEGRATION.md      # This file
```

## Usage

### Basic Pattern

```typescript
import type { paths, components } from './openapi/gen-types';

// 1. Extract types for your endpoint
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
type MetadataParams = paths['/metadata']['get']['parameters']['query'];

// 2. Use types in your function
async function fetchMetadata(
  request: RequestFunction,
  limit?: number
): Promise<MetadataResponse> {
  const params: MetadataParams = {
    limit,
    limit_per_metric: 10,
  };

  return await request('/api/v1/metadata', params);
}
```

### Creating Type Aliases

For cleaner code, create type aliases in your module:

```typescript
// types.ts
import type { paths, components } from './openapi/gen-types';

// Response types
export type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
export type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
export type LabelValuesResponse = paths['/label/{name}/values']['get']['responses']['200']['content']['application/json'];
export type SeriesResponse = paths['/series']['get']['responses']['200']['content']['application/json'];
export type QueryResponse = paths['/query']['get']['responses']['200']['content']['application/json'];

// Parameter types
export type MetadataParams = paths['/metadata']['get']['parameters']['query'];
export type LabelsParams = paths['/labels']['get']['parameters']['query'];
export type LabelValuesParams = paths['/label/{name}/values']['get']['parameters']['query'];
export type SeriesParams = paths['/series']['get']['parameters']['query'];
export type QueryParams = paths['/query']['get']['parameters']['query'];

// Component types
export type Labels = components['schemas']['Labels'];
export type Metadata = components['schemas']['Metadata'];
export type ErrorResponse = components['schemas']['Error'];

// Usage
import { MetadataParams, MetadataResponse } from './types';

const params: MetadataParams = { limit: 1000 };
const response: MetadataResponse = await request('/api/v1/metadata', params);
```

## Common Patterns

### 1. Metadata Fetching

```typescript
import type { paths } from './openapi/gen-types';

type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
type MetadataParams = paths['/metadata']['get']['parameters']['query'];

async function queryMetadata(
  request: RequestFunction,
  limit?: number
): Promise<MetadataResponse> {
  const params: MetadataParams = {
    limit: limit ?? 1000,
    limit_per_metric: 10,
  };

  const response: MetadataResponse = await request('/api/v1/metadata', params);

  // Check response status
  if (response.status !== 'success') {
    throw new Error('Failed to fetch metadata');
  }

  return response;
}
```

### 2. Label Fetching

```typescript
import type { paths } from './openapi/gen-types';

type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
type LabelsParams = paths['/labels']['get']['parameters']['query'];

async function queryLabels(
  request: RequestFunction,
  timeRange: TimeRange
): Promise<string[]> {
  const params: LabelsParams = {
    start: timeRange.from.unix(),
    end: timeRange.to.unix(),
    'match[]': ['{job="prometheus"}'],
    limit: 1000,
  };

  const response: LabelsResponse = await request('/api/v1/labels', params);

  return response.data;  // string[]
}
```

### 3. Label Values Fetching

```typescript
import type { paths } from './openapi/gen-types';

type LabelValuesResponse = paths['/label/{name}/values']['get']['responses']['200']['content']['application/json'];
type LabelValuesParams = paths['/label/{name}/values']['get']['parameters']['query'];

async function queryLabelValues(
  request: RequestFunction,
  labelName: string,
  timeRange: TimeRange
): Promise<string[]> {
  const params: LabelValuesParams = {
    start: timeRange.from.unix(),
    end: timeRange.to.unix(),
    'match[]': ['{job="prometheus"}'],
    limit: 1000,
  };

  const response: LabelValuesResponse = await request(
    `/api/v1/label/${labelName}/values`,
    params
  );

  return response.data;  // string[]
}
```

### 4. Query Execution

```typescript
import type { paths } from './openapi/gen-types';

type QueryResponse = paths['/query']['get']['responses']['200']['content']['application/json'];
type QueryParams = paths['/query']['get']['parameters']['query'];

async function executeQuery(
  request: RequestFunction,
  expr: string,
  time?: number
): Promise<QueryResponse> {
  const params: QueryParams = {
    query: expr,
    time: time ?? Date.now() / 1000,
    timeout: '30s',
  };

  const response: QueryResponse = await request('/api/v1/query', params);

  if (response.status !== 'success') {
    console.error('Query failed:', response);
    throw new Error('Query execution failed');
  }

  return response;
}
```

## Runtime Feature Detection

### Why?

Different Prometheus versions support different features:
- Prometheus 2.24+ supports `/api/v1/labels` with `match[]`
- Prometheus 2.35+ supports `lookback_delta` parameter
- Prometheus 2.40+ supports `stats` parameter

Instead of hard-coding version checks, fetch the OpenAPI spec at runtime!

### Implementation

```typescript
async function detectAPIFeatures(baseUrl: string): Promise<Set<string>> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/openapi.yaml`);

    if (!response.ok) {
      // OpenAPI not available (older Prometheus)
      return new Set();
    }

    const spec = await response.text();
    const features = new Set<string>();

    // Check for specific features in the spec
    if (spec.includes('lookback_delta')) {
      features.add('lookback_delta');
    }

    if (spec.includes('stats')) {
      features.add('stats');
    }

    if (spec.includes('query_exemplars')) {
      features.add('exemplars');
    }

    return features;
  } catch (error) {
    console.warn('Failed to detect API features:', error);
    return new Set();
  }
}

// Cache capabilities to avoid repeated fetches
class PrometheusCapabilities {
  private cache = new Map<string, Set<string>>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async detect(url: string): Promise<Set<string>> {
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    const features = await detectAPIFeatures(url);
    this.cache.set(url, features);

    // Clear cache after TTL
    setTimeout(() => this.cache.delete(url), this.ttl);

    return features;
  }
}

// Usage in datasource
class PrometheusDatasource {
  private capabilities = new PrometheusCapabilities();

  async init() {
    const features = await this.capabilities.detect(this.url);

    if (features.has('stats')) {
      console.log('Query statistics available');
    }

    if (features.has('lookback_delta')) {
      console.log('Lookback delta parameter supported');
    }
  }

  async query(expr: string) {
    const features = await this.capabilities.detect(this.url);

    const params: QueryParams = {
      query: expr,
      time: Date.now() / 1000,
    };

    // Conditionally add parameters based on features
    if (features.has('stats')) {
      params.stats = 'all';
    }

    if (features.has('lookback_delta')) {
      params.lookback_delta = '5m';
    }

    return this.request('/api/v1/query', params);
  }
}
```

## Migration Guide

### Gradual Migration

You don't need to convert everything at once:

#### Step 1: Add Types (No Behavior Change)

```typescript
import type { paths } from './openapi/gen-types';

type MetadataParams = paths['/metadata']['get']['parameters']['query'];
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];

// Before
private async _queryMetadata(limit?: number) {
  const metadata = await this.request('/api/v1/metadata', { limit });
  return metadata;
}

// After (same behavior, but typed)
private async _queryMetadata(limit?: number): Promise<MetadataResponse> {
  const params: MetadataParams = { limit };
  const response: MetadataResponse = await this.request('/api/v1/metadata', params);
  return response;
}
```

#### Step 2: Add Error Checking

```typescript
private async _queryMetadata(limit?: number): Promise<MetadataResponse> {
  const params: MetadataParams = { limit };
  const response: MetadataResponse = await this.request('/api/v1/metadata', params);

  // Add runtime checking
  if (response.status !== 'success') {
    console.error('Metadata fetch failed:', response.error);
    throw new Error('Failed to fetch metadata');
  }

  return response;
}
```

#### Step 3: Use Feature Detection

```typescript
private async _queryMetadata(
  limit?: number,
  capabilities?: Set<string>
): Promise<MetadataResponse> {
  const params: MetadataParams = { limit };

  // Use feature detection
  if (capabilities?.has('limit_per_metric')) {
    params.limit_per_metric = 10;
  }

  const response: MetadataResponse = await this.request('/api/v1/metadata', params);

  if (response.status !== 'success') {
    throw new Error(`Metadata fetch failed: ${response.error}`);
  }

  return response;
}
```

## Best Practices

### 1. Use Type Annotations

```typescript
// ✅ Good
const params: MetadataParams = { limit: 1000 };

// ❌ Bad (loses type checking)
const params = { limit: 1000 };
```

### 2. Check Response Status

```typescript
// ✅ Good
if (response.status !== 'success') {
  throw new Error('Request failed');
}

// ❌ Bad (might crash)
return response.data;
```

### 3. Create Type Aliases

```typescript
// ✅ Good (readable)
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
const response: MetadataResponse = ...;

// ❌ Bad (verbose)
const response: paths['/metadata']['get']['responses']['200']['content']['application/json'] = ...;
```

### 4. Cache Feature Detection

```typescript
// ✅ Good (cached)
private capabilities: Set<string> | null = null;

async init() {
  this.capabilities = await detectAPIFeatures(this.url);
}

// ❌ Bad (fetches every time)
async query() {
  const caps = await detectAPIFeatures(this.url);  // Slow!
}
```

## Troubleshooting

### Types are outdated

```bash
# Regenerate from running Prometheus
export PROMETHEUS_URL=http://localhost:9090
yarn generate-types:remote
```

### Type errors after regenerating

The API changed. Update your code to match new parameter names.

### Runtime errors despite types

1. **Outdated types**: Regenerate from current Prometheus version
2. **Feature not supported**: Use runtime feature detection
3. **Variable interpolation**: Ensure variables are interpolated before passing to API

```typescript
// ❌ Wrong
const params = { query: '$metric' };

// ✅ Correct
const params = {
  query: this.datasource.interpolateString('$metric')
};
```

## Summary

### Key Points

1. **Import types** from `./openapi/gen-types`
2. **Extract types** using `paths['/endpoint']['method']...`
3. **Create aliases** for commonly used types
4. **Use feature detection** for runtime capability checks
5. **Regenerate types** when Prometheus version changes

### Next Steps

1. Read `src/openapi/README.md` for quick reference
2. Start adding types to one function (e.g., `_queryMetadata`)
3. Gradually expand to other API calls
4. Implement feature detection for new Prometheus features

### Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [openapi-typescript](https://github.com/drwpow/openapi-typescript)
- [Prometheus API Docs](https://prometheus.io/docs/prometheus/latest/querying/api/)
