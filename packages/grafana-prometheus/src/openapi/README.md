# OpenAPI Generated Types for Prometheus API

TypeScript type definitions generated from the Prometheus OpenAPI specification.

## Reality Check: Why Use These Types?

**Important Context**: Many Prometheus instances we connect to:
- Don't support OpenAPI spec (added in Prometheus 2.45+)
- Are older versions or Prometheus-compatible systems (Mimir, Cortex, Thanos)
- Can't be queried for OpenAPI spec at runtime

**So why have these types?**

### Value Proposition

Even without runtime OpenAPI detection, these types provide:

#### 1. **Compile-Time Type Safety** ✅

```typescript
import type { paths } from './openapi/gen-types';

type MetadataParams = paths['/metadata']['get']['parameters']['query'];

// ✅ Catches typos and wrong types at compile-time
const params: MetadataParams = {
  limit: 1000,
  limitt: 100,  // ❌ TypeScript error - catches bug before runtime
};
```

#### 2. **IDE Autocomplete & Documentation** ✅

```typescript
const params: MetadataParams = {
  limit: 1000,
  // Type Ctrl+Space here - IDE shows ALL available parameters:
  // - limit_per_metric
  // - metric
  // etc.
};
```

No need to check Prometheus docs - types ARE the documentation.

#### 3. **Backwards Compatibility Built-In** ✅

**Key insight**: Prometheus API is additive. New versions add optional parameters, they don't break old ones.

```typescript
const params: MetadataParams = {
  limit: 1000,              // Works on ALL versions
  limit_per_metric: 10,     // OPTIONAL - old versions safely ignore it
};
```

Types from the latest spec work with old versions because new parameters are optional.

## When to Use These Types

### ✅ Use Them For:

- **Type safety** - Prevent typos and wrong parameter types
- **IDE support** - Autocomplete for all available parameters
- **Documentation** - Self-documenting code
- **Future-proofing** - Easy updates when Prometheus adds features

### ⚠️ Don't Rely On:

- **Runtime OpenAPI detection** - Many instances don't support it
- **Types guaranteeing compatibility** - Still need version checks

## Recommended Pattern: Types + Version Detection

Use OpenAPI types for structure, but version detection for runtime decisions:

### The Hybrid Approach

```typescript
import type { paths } from './openapi/gen-types';

type MetadataParams = paths['/metadata']['get']['parameters']['query'];
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];

class PrometheusLanguageProvider {
  private async _queryMetadata(limit?: number): Promise<PromMetricsMetadata> {
    // Start with base params that work everywhere
    const params: Partial<MetadataParams> = {
      limit: limit ?? this.datasource.seriesLimit,
    };

    // Conditionally add new parameters based on version detection
    if (this.supportsLimitPerMetric()) {
      params.limit_per_metric = 10;
    }

    const response = await this.request('/api/v1/metadata', params);
    return fixSummariesMetadata(response);
  }

  private supportsLimitPerMetric(): boolean {
    // Use existing version detection
    return this._isDatasourceVersionGreaterOrEqualTo('2.45.0', PromApplication.Prometheus);
  }
}
```

**Why this works:**
- ✅ Get type safety from OpenAPI types
- ✅ Get compatibility from version detection
- ✅ No runtime OpenAPI fetching needed
- ✅ Works with old and new Prometheus versions

## Quick Start

### Import Types

```typescript
import type { paths, components } from './openapi/gen-types';
```

### Extract Types for Your Endpoint

```typescript
// For metadata endpoint
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
type MetadataParams = paths['/metadata']['get']['parameters']['query'];

// For labels endpoint
type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
type LabelsParams = paths['/labels']['get']['parameters']['query'];
```

### Use in Your Code

```typescript
async function queryMetadata(
  request: RequestFunction,
  limit?: number
): Promise<MetadataResponse> {
  const params: Partial<MetadataParams> = {
    limit: limit ?? 1000,
  };

  const response: MetadataResponse = await request('/api/v1/metadata', params);

  if (response.status !== 'success') {
    throw new Error('Failed to fetch metadata');
  }

  return response;
}
```

## Common Patterns

### Pattern 1: Metadata Fetching with Version Detection

```typescript
import type { paths } from './openapi/gen-types';

type MetadataParams = paths['/metadata']['get']['parameters']['query'];
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];

private async _queryMetadata(limit?: number): Promise<PromMetricsMetadata> {
  // Use Partial<> to make all parameters optional
  const params: Partial<MetadataParams> = {
    limit: limit ?? this.datasource.seriesLimit,
  };

  // Add parameters based on version detection
  if (this._isDatasourceVersionGreaterOrEqualTo('2.45.0', PromApplication.Prometheus)) {
    params.limit_per_metric = 10;
  }

  const response: MetadataResponse = await this.request('/api/v1/metadata', params);
  return fixSummariesMetadata(response);
}
```

### Pattern 2: Labels with Conditional Match Parameter

```typescript
import type { paths } from './openapi/gen-types';

type LabelsParams = paths['/labels']['get']['parameters']['query'];
type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];

async function queryLabels(timeRange: TimeRange, match?: string): Promise<string[]> {
  const params: Partial<LabelsParams> = {
    start: timeRange.from.unix(),
    end: timeRange.to.unix(),
    limit: 1000,
  };

  // Only add match[] if version supports it
  if (this.hasLabelsMatchAPISupport() && match) {
    params['match[]'] = [match];
  }

  const response: LabelsResponse = await this.request('/api/v1/labels', params);
  return response.data;
}
```

### Pattern 3: Query with Optional New Parameters

```typescript
import type { paths } from './openapi/gen-types';

type QueryParams = paths['/query']['get']['parameters']['query'];
type QueryResponse = paths['/query']['get']['responses']['200']['content']['application/json'];

async function executeQuery(expr: string, options?: { enableStats?: boolean }): Promise<QueryResponse> {
  const params: Partial<QueryParams> = {
    query: expr,
    time: Date.now() / 1000,
    timeout: '30s',
  };

  // Conditionally add stats parameter
  if (options?.enableStats && this.supportsStats()) {
    params.stats = 'all';
  }

  // Conditionally add lookback_delta parameter
  if (this.supportsLookbackDelta()) {
    params.lookback_delta = '5m';
  }

  const response: QueryResponse = await this.request('/api/v1/query', params);
  return response;
}

private supportsStats(): boolean {
  return this._isDatasourceVersionGreaterOrEqualTo('2.40.0', PromApplication.Prometheus);
}

private supportsLookbackDelta(): boolean {
  return this._isDatasourceVersionGreaterOrEqualTo('2.35.0', PromApplication.Prometheus);
}
```

## Using Component Schemas

```typescript
import type { components } from './openapi/gen-types';

// Extract reusable schema types
type Labels = components['schemas']['Labels'];
type Metadata = components['schemas']['Metadata'];
type ErrorResponse = components['schemas']['Error'];

// Use in your functions
function processMetadata(metadata: Metadata): void {
  console.log(`Type: ${metadata.type}`);    // counter, gauge, histogram, etc.
  console.log(`Help: ${metadata.help}`);    // Description
  console.log(`Unit: ${metadata.unit}`);    // Unit information
}
```

## Optional: Runtime OpenAPI Detection

**Only use this if** you know your Prometheus instances support OpenAPI (version 2.45+):

```typescript
async function detectOpenAPISupport(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/openapi.yaml`);
    return response.ok;
  } catch {
    return false;
  }
}

// Hybrid detection: try OpenAPI first, fallback to version detection
async function detectCapabilities(): Promise<Map<string, boolean>> {
  const hasOpenAPI = await this.detectOpenAPISupport(this.datasource.url);

  if (hasOpenAPI) {
    // Future-proof: use OpenAPI spec
    return await this.detectFromOpenAPI();
  } else {
    // Current reality: use version detection
    return this.detectFromVersion();
  }
}

private detectFromVersion(): Map<string, boolean> {
  const features = new Map<string, boolean>();
  const version = this.datasource.prometheusVersion;

  features.set('limit_per_metric', this.compareVersion(version, '2.45.0') >= 0);
  features.set('lookback_delta', this.compareVersion(version, '2.35.0') >= 0);
  features.set('stats', this.compareVersion(version, '2.40.0') >= 0);

  return features;
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

Fetches OpenAPI spec from a running Prometheus server (requires Prometheus 2.45+).

## Type Aliases for Cleaner Code

Create a types file with aliases to avoid repetition:

```typescript
// prometheus_api_types.ts
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

// Usage
import { MetadataParams, MetadataResponse } from './prometheus_api_types';

const params: Partial<MetadataParams> = { limit: 1000 };
const response: MetadataResponse = await request('/api/v1/metadata', params);
```

## Best Practices

### 1. Always Use `Partial<>` for Parameters

```typescript
// ✅ Good - makes all parameters optional
const params: Partial<MetadataParams> = {
  limit: 1000,
};

// ❌ Bad - TypeScript may require all parameters
const params: MetadataParams = {
  limit: 1000,
};
```

### 2. Combine Types with Version Detection

```typescript
// ✅ Good - type-safe AND version-aware
const params: Partial<QueryParams> = { query: 'up' };

if (this.supportsStats()) {
  params.stats = 'all';
}

// ❌ Bad - types without version checks
const params: QueryParams = {
  query: 'up',
  stats: 'all',  // Might not be supported!
};
```

### 3. Check Response Status

```typescript
// ✅ Good - always check status
const response: MetadataResponse = await request('/api/v1/metadata', params);

if (response.status !== 'success') {
  throw new Error('Request failed');
}

// ❌ Bad - assumes success
return response.data;
```

### 4. Use Existing Version Detection Methods

```typescript
// ✅ Good - use existing infrastructure
if (this._isDatasourceVersionGreaterOrEqualTo('2.45.0', PromApplication.Prometheus)) {
  params.limit_per_metric = 10;
}

// ❌ Bad - don't create new detection logic
if (this.datasource.prometheusVersion === '2.45.0') {  // Fragile!
  params.limit_per_metric = 10;
}
```

## Troubleshooting

### Types are outdated

```bash
# Regenerate from latest Prometheus (requires 2.45+)
export PROMETHEUS_URL=http://localhost:9090
yarn generate-types:remote
```

### Type errors after regenerating

The Prometheus API changed. Update your code to match new parameter names or response structures.

### Parameter errors at runtime despite types

**Root cause**: Your Prometheus version doesn't support that parameter.

**Solution**: Use version detection:

```typescript
const params: Partial<QueryParams> = { query: 'up' };

// Only add if supported
if (this.supportsLookbackDelta()) {
  params.lookback_delta = '5m';
}
```

### Getting "property does not exist" errors

**Root cause**: Using strict types without `Partial<>`.

**Solution**: Use `Partial<>` for parameter types:

```typescript
// ✅ Fix
const params: Partial<MetadataParams> = { limit: 1000 };

// ❌ Error
const params: MetadataParams = { limit: 1000 };
```

## Summary

### What These Types Provide

- ✅ **Compile-time type safety** - Catch bugs in your code
- ✅ **IDE autocomplete** - See all available parameters
- ✅ **Self-documentation** - Types are the API documentation
- ✅ **Future-proofing** - Easy to add new parameters

### What They Don't Provide

- ❌ **Runtime compatibility** - Still need version detection
- ❌ **Universal support** - Many Prometheus instances don't have OpenAPI
- ❌ **Automatic feature detection** - Version checks still needed

### Recommended Approach

1. **Use OpenAPI types** for structure and type safety
2. **Use `Partial<>` wrapper** to make parameters optional
3. **Use version detection** for runtime compatibility
4. **Combine both** for best results

### Key Pattern

```typescript
import type { paths } from './openapi/gen-types';

type Params = paths['/endpoint']['get']['parameters']['query'];
type Response = paths['/endpoint']['get']['responses']['200']['content']['application/json'];

async function query(): Promise<Response> {
  // Type-safe base parameters
  const params: Partial<Params> = {
    /* base params that work everywhere */
  };

  // Version-aware optional parameters
  if (this.supportsFeature()) {
    params.newFeature = value;
  }

  return await this.request('/api/v1/endpoint', params);
}
```

This gives you the best of both worlds: **type safety from OpenAPI** + **compatibility from version detection**.
