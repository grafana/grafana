export interface DashboardSceneJsonApiV2 {
  /**
   * Read the currently open dashboard as v2beta1 Dashboard kind JSON (JSON string).
   */
  getCurrentDashboard(space?: number): string;

  /**
   * Read query errors for the currently open dashboard (JSON string).
   *
   * This returns a JSON array of objects shaped like:
   * `{ panelId, panelTitle, refId?, datasource?, message, severity }`.
   */
  getCurrentDashboardErrors(space?: number): string;

  /**
   * Read current dashboard variables (JSON string).
   *
   * This returns JSON shaped like:
   * `{ variables: [{ name, value }] }`
   * where `value` is `string | string[]`.
   */
  getCurrentDashboardVariables(space?: number): string;

  /**
   * Apply dashboard variable values (JSON string).
   *
   * Accepts either:
   * - `{ variables: [{ name, value }] }`
   * - or a map `{ [name]: value }`
   *
   * where `value` is `string | string[]`.
   */
  applyCurrentDashboardVariables(varsJson: string): void;

  /**
   * Read the current dashboard time range (JSON string).
   *
   * This returns JSON shaped like:
   * `{ from, to, timezone? }`.
   */
  getCurrentDashboardTimeRange(space?: number): string;

  /**
   * Apply the current dashboard time range (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ from, to, timezone? }` where `from/to` are Grafana raw strings (e.g. `now-6h`, `now`).
   */
  applyCurrentDashboardTimeRange(timeRangeJson: string): void;

  /**
   * Select a tab within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ title?: string, slug?: string }`.
   */
  selectCurrentDashboardTab(tabJson: string): void;

  /**
   * Read current in-dashboard navigation state (JSON string).
   *
   * This returns JSON shaped like:
   * `{ tab: { slug: string, title?: string } | null }`.
   */
  getCurrentDashboardNavigation(space?: number): string;

  /**
   * Scroll/focus a row within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ title?: string, rowKey?: string }`.
   */
  focusCurrentDashboardRow(rowJson: string): void;

  /**
   * Scroll/focus a panel within the current dashboard (JSON string).
   *
   * Accepts JSON shaped like:
   * `{ panelId: number }`.
   */
  focusCurrentDashboardPanel(panelJson: string): void;

  /**
   * Apply a v2beta1 Dashboard kind JSON (JSON string).
   *
   * Implementations must enforce **spec-only** updates by rejecting any changes to
   * `apiVersion`, `kind`, `metadata`, or `status`.
   */
  applyCurrentDashboard(resourceJson: string): void;
}

let singletonInstance: DashboardSceneJsonApiV2 | undefined;

/**
 * Used during startup by Grafana to register the implementation.
 *
 * @internal
 */
export function setDashboardSceneJsonApiV2(instance: DashboardSceneJsonApiV2) {
  singletonInstance = instance;
}

/**
 * Returns the registered DashboardScene JSON API.
 *
 * @public
 */
export function getDashboardSceneJsonApiV2(): DashboardSceneJsonApiV2 {
  if (!singletonInstance) {
    throw new Error('DashboardScene JSON API is not available');
  }
  return singletonInstance;
}

/**
 * A grouped, ergonomic API wrapper around the DashboardScene JSON API.
 *
 * This is purely a convenience layer: it calls the same underlying registered implementation
 * as the top-level helper functions, but organizes functionality into namespaces like
 * `navigation`, `variables`, and `timeRange`.
 *
 * @public
 */
export function getDashboardApi() {
  const api = getDashboardSceneJsonApiV2();
  let cachedDashboardSchemaBundle: { bundle: unknown; loadedAt: number } | undefined;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function collectRefs(value: unknown, out: Set<string>) {
    if (Array.isArray(value)) {
      for (const v of value) {
        collectRefs(v, out);
      }
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      if (k === '$ref' && typeof v === 'string') {
        out.add(v);
      } else {
        collectRefs(v, out);
      }
    }
  }

  function buildOpenApiSchemaBundle(openapi: unknown) {
    if (!isRecord(openapi)) {
      throw new Error('OpenAPI document is not an object');
    }
    const info = openapi['info'];
    if (!isRecord(info)) {
      throw new Error('OpenAPI document is missing info');
    }
    const title = info['title'];
    if (typeof title !== 'string' || title.length === 0) {
      throw new Error('OpenAPI document is missing info.title');
    }
    // This endpoint is expected to return the group/version doc, so validate it explicitly.
    if (title !== 'dashboard.grafana.app/v2beta1') {
      throw new Error(`OpenAPI document is not dashboard.grafana.app/v2beta1 (info.title="${title}")`);
    }

    const components = openapi['components'];
    if (!isRecord(components)) {
      throw new Error('OpenAPI document is missing components');
    }
    const schemas = components['schemas'];
    if (!isRecord(schemas)) {
      throw new Error('OpenAPI document is missing components.schemas');
    }

    // Find the Dashboard kind schema key by GVK annotation.
    const dashboardKey = Object.entries(schemas).find(([_, schema]) => {
      if (!isRecord(schema)) {
        return false;
      }
      const gvk = schema['x-kubernetes-group-version-kind'];
      if (!Array.isArray(gvk)) {
        return false;
      }
      return gvk.some((x) => {
        return (
          isRecord(x) &&
          x['group'] === 'dashboard.grafana.app' &&
          x['version'] === 'v2beta1' &&
          x['kind'] === 'Dashboard'
        );
      });
    })?.[0];

    if (!dashboardKey) {
      throw new Error('Could not find dashboard.grafana.app/v2beta1 Dashboard schema in OpenAPI document');
    }

    const rootRef = `#/components/schemas/${dashboardKey}`;
    const pickedSchemas: Record<string, unknown> = {};
    const visited = new Set<string>();
    const queue: string[] = [rootRef];

    while (queue.length) {
      const ref = queue.shift()!;
      if (!ref.startsWith('#/components/schemas/')) {
        continue;
      }
      const key = ref.slice('#/components/schemas/'.length);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const schema = schemas[key];
      if (!schema) {
        continue;
      }
      pickedSchemas[key] = schema;

      const refs = new Set<string>();
      collectRefs(schema, refs);
      for (const r of refs) {
        if (r.startsWith('#/components/schemas/')) {
          queue.push(r);
        }
      }
    }

    // Sanity-check the root schema shape (helps LLM consumers, and catches wrong schema sources quickly).
    const rootSchema = pickedSchemas[dashboardKey];
    if (!isRecord(rootSchema)) {
      throw new Error('Dashboard schema is not an object');
    }
    const required = rootSchema['required'];
    if (!Array.isArray(required)) {
      throw new Error('Dashboard schema is missing required fields list');
    }
    for (const req of ['apiVersion', 'kind', 'metadata', 'spec']) {
      if (!required.includes(req)) {
        throw new Error(`Dashboard schema is missing required field "${req}"`);
      }
    }

    return {
      format: 'openapi3.schemaBundle',
      source: {
        url: '/openapi/v3/apis/dashboard.grafana.app/v2beta1',
      },
      group: 'dashboard.grafana.app',
      version: 'v2beta1',
      kind: 'Dashboard',
      root: { $ref: rootRef },
      stats: { schemas: Object.keys(pickedSchemas).length },
      validation: {
        ok: true,
        info: {
          title,
        },
        root: {
          ref: rootRef,
          required: ['apiVersion', 'kind', 'metadata', 'spec'],
        },
      },
      components: {
        schemas: pickedSchemas,
      },
    };
  }

  return {
    /**
     * Prints/returns a quick reference for the grouped dashboard API, including expected JSON shapes.
     */
    help: () => {
      const text = [
        'Dashboard API (DashboardScene JSON API, schema v2 kinds)',
        '',
        'All inputs/outputs are JSON strings.',
        'Edits are spec-only: apiVersion/kind/metadata/status must not change.',
        '',
        'Schema (for LLMs):',
        '- schema.getSources(space?): string',
        '- schema.getDashboard(space?): Promise<string>',
        '- schema.getDashboardSync(space?): string',
        '  - getDashboard() fetches the OpenAPI v3 document for dashboard.grafana.app/v2beta1 and returns a schema bundle.',
        '  - getDashboard() validates the document is for dashboard.grafana.app/v2beta1 and that the root schema is the Dashboard kind.',
        '',
        'Read/apply dashboard:',
        '- dashboard.getCurrent(space?): string',
        '- dashboard.apply(resourceJson: string): void',
        '  - resourceJson must be a v2beta1 Dashboard kind object:',
        '    { apiVersion: "dashboard.grafana.app/v2beta1", kind: "Dashboard", metadata: {...}, spec: {...}, status: {...} }',
        '',
        'Errors:',
        '- errors.getCurrent(space?): string',
        '  - returns JSON: { errors: [{ panelId, panelTitle, refId?, datasource?, message, severity }] }',
        '',
        'Variables:',
        '- variables.getCurrent(space?): string',
        '  - returns JSON: { variables: [{ name, value }] } where value is string | string[]',
        '- variables.apply(varsJson: string): void',
        '  - accepts JSON: { variables: [{ name, value }] } OR { [name]: value }',
        '',
        'Time range:',
        '- timeRange.getCurrent(space?): string',
        '  - returns JSON: { from: string, to: string, timezone?: string }',
        '- timeRange.apply(timeRangeJson: string): void',
        '  - accepts JSON: { from: "now-6h", to: "now", timezone?: "browser" | "utc" | ... }',
        '',
        'Navigation:',
        '- navigation.getCurrent(space?): string',
        '  - returns JSON: { tab: { slug: string, title?: string } | null }',
        '- navigation.selectTab(tabJson: string): void',
        '  - accepts JSON: { title?: string, slug?: string }',
        '- navigation.focusRow(rowJson: string): void',
        '  - accepts JSON: { title?: string, rowKey?: string }',
        '- navigation.focusPanel(panelJson: string): void',
        '  - accepts JSON: { panelId: number }',
        '',
        'Examples:',
        '- const schema = JSON.parse(await window.dashboardApi.schema.getDashboard(0))',
        '- window.dashboardApi.timeRange.apply(JSON.stringify({ from: "now-6h", to: "now", timezone: "browser" }))',
        '- window.dashboardApi.navigation.selectTab(JSON.stringify({ title: "Overview" }))',
        '- window.dashboardApi.navigation.focusPanel(JSON.stringify({ panelId: 12 }))',
      ].join('\n');

      // Calling help is an explicit action; logging is useful in the browser console.
      // Return the text as well so callers can print/store it as they prefer.
      try {
        // eslint-disable-next-line no-console
        console.log(text);
      } catch {
        // ignore
      }

      return text;
    },
    schema: {
      /**
       * Returns where this API loads schema documents from.
       */
      getSources: (space = 2) => {
        return JSON.stringify(
          {
            openapi3: {
              url: '/openapi/v3/apis/dashboard.grafana.app/v2beta1',
              note: 'This is the Kubernetes-style OpenAPI document for dashboard.grafana.app/v2beta1. `schema.getDashboard()` extracts the Dashboard schemas into a smaller bundle.',
            },
          },
          null,
          space
        );
      },
      /**
       * Fetches and returns an OpenAPI schema bundle for `dashboard.grafana.app/v2beta1` `Dashboard`.
       *
       * Returns a JSON string (async) shaped like:
       * `{ format, source, group, version, kind, root, stats, components: { schemas } }`.
       */
      getDashboard: async (space = 2) => {
        if (!cachedDashboardSchemaBundle) {
          const rsp = await fetch('/openapi/v3/apis/dashboard.grafana.app/v2beta1', { credentials: 'same-origin' });
          if (!rsp.ok) {
            throw new Error(
              `Failed to fetch OpenAPI document from /openapi/v3/apis/dashboard.grafana.app/v2beta1 (status ${rsp.status})`
            );
          }
          const openapi: unknown = await rsp.json();
          cachedDashboardSchemaBundle = { bundle: buildOpenApiSchemaBundle(openapi), loadedAt: Date.now() };
        }
        return JSON.stringify(cachedDashboardSchemaBundle.bundle, null, space);
      },
      /**
       * Returns the cached schema bundle (sync), if previously loaded by `schema.getDashboard()`.
       */
      getDashboardSync: (space = 2) => {
        if (!cachedDashboardSchemaBundle) {
          throw new Error('Schema bundle is not loaded. Call `await dashboardApi.schema.getDashboard()` first.');
        }
        return JSON.stringify(cachedDashboardSchemaBundle.bundle, null, space);
      },
    },
    dashboard: {
      getCurrent: (space = 2) => api.getCurrentDashboard(space),
      apply: (resourceJson: string) => api.applyCurrentDashboard(resourceJson),
    },
    errors: {
      getCurrent: (space = 2) =>
        JSON.stringify({ errors: JSON.parse(api.getCurrentDashboardErrors(space)) }, null, space),
    },
    variables: {
      getCurrent: (space = 2) => api.getCurrentDashboardVariables(space),
      apply: (varsJson: string) => api.applyCurrentDashboardVariables(varsJson),
    },
    timeRange: {
      getCurrent: (space = 2) => api.getCurrentDashboardTimeRange(space),
      apply: (timeRangeJson: string) => api.applyCurrentDashboardTimeRange(timeRangeJson),
    },
    navigation: {
      getCurrent: (space = 2) => api.getCurrentDashboardNavigation(space),
      selectTab: (tabJson: string) => api.selectCurrentDashboardTab(tabJson),
      focusRow: (rowJson: string) => api.focusCurrentDashboardRow(rowJson),
      focusPanel: (panelJson: string) => api.focusCurrentDashboardPanel(panelJson),
    },
  };
}
