import { Draft07 } from 'json-schema-library';
import draft07Schema from 'json-schema-library/remotes/draft07.json';

import { type ComponentDescriptor, type ExposedComponentDiscovery } from '@grafana/data';
import { isAppPluginEnabled } from '@grafana/runtime';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import { isRecord } from 'app/core/utils/isRecord';

const metaSchema = new Draft07(draft07Schema);

function isPublishedSchema(value: unknown): boolean {
  return isRecord(value) && metaSchema.validate(value).length === 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDiscovery(value: unknown): value is ExposedComponentDiscovery {
  if (
    !isRecord(value) ||
    value.version !== 'v1' ||
    !isNonEmptyString(value.datasource) ||
    !isNonEmptyString(value.prompt) ||
    (value.props !== undefined && !isPublishedSchema(value.props))
  ) {
    return false;
  }

  if (value.events === undefined) {
    return true;
  }
  if (!Array.isArray(value.events)) {
    return false;
  }

  const names = new Set<string>();
  for (const event of value.events) {
    if (
      !isRecord(event) ||
      !isNonEmptyString(event.name) ||
      names.has(event.name) ||
      (event.payload !== undefined && !isPublishedSchema(event.payload))
    ) {
      return false;
    }
    names.add(event.name);
  }
  return true;
}

export async function loadComponentDescriptorRegistry() {
  const apps = await getAppPluginMetas();
  const groups = await Promise.all(
    apps.map(async (app) => {
      const entries = app.extensions.exposedComponents.flatMap(({ id, title, description, discovery }) => {
        if (!id.startsWith(`${app.id}/`) || !isValidDiscovery(discovery)) {
          return [];
        }
        return [{ ...discovery, id, title, description, pluginId: app.id }];
      });
      if (!entries.length || !(await isAppPluginEnabled(app.id))) {
        return [];
      }
      return entries;
    })
  );

  const byId = new Map<string, ComponentDescriptor>();
  for (const entry of groups.flat()) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return {
    get: (id: string) => byId.get(id),
    list: (datasource?: string) =>
      Array.from(byId.values()).filter((entry) => datasource === undefined || entry.datasource === datasource),
  };
}
