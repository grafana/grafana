import yaml from 'js-yaml';

import { type SchemaEditorFormat } from './DashboardSchemaEditor';

export function parseDashboardSchema(text: string, format: SchemaEditorFormat) {
  try {
    const json = format === 'yaml' ? JSON.stringify(yaml.load(text), null, 2) : text;
    if (json === undefined) {
      throw new Error('YAML must contain a JSON value');
    }
    const value: unknown = JSON.parse(json);
    return { hasParseError: false as const, json, value };
  } catch (error) {
    return { hasParseError: true as const, error: String(error) };
  }
}
