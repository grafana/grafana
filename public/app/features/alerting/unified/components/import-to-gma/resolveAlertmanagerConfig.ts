import { load } from 'js-yaml';

import { type AlertmanagerUserConfig } from '@grafana/alerting/convert';
import { t } from '@grafana/i18n';

import { fetchAlertManagerConfig } from '../../api/alertmanager';

import { findDuplicateTemplateFileName } from './steps/utils';

export interface NotificationsSourceParams {
  source: 'datasource' | 'yaml';
  /** Datasource name (not UID) - required when source is 'datasource' */
  datasourceName?: string;
  yamlFile: File | null;
  /**
   * Separate notification template files uploaded alongside the YAML config.
   * On disk users keep the Alertmanager config and template files separately (mimirtool combines
   * them on the fly); the wizard reads these and merges them into the request's template_files map.
   */
  templateFiles?: File[];
  /** Configuration identifier - the name of the extra config (policy tree name) */
  configIdentifier: string;
  /** If true, promote (merge) the imported config into the main Grafana config */
  promote?: boolean;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadYaml(content: string, { embedded = false } = {}): unknown {
  try {
    return load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Fail locally instead of shipping invalid YAML to the backend for a generic error there.
    // Embedded errors get their own message because their line numbers are relative to the string, not the file.
    throw new Error(
      embedded
        ? t(
            'alerting.import-to-gma.step1.embedded-yaml-parse-error',
            'The YAML in "alertmanager_config" has a syntax error: {{message}}',
            { message }
          )
        : t('alerting.import-to-gma.step1.yaml-parse-error', 'Your YAML has a syntax error: {{message}}', { message })
    );
  }
}

/**
 * Parse an Alertmanager YAML file and separate template_files from the alertmanager config.
 *
 * Accepts the flat mimirtool layout (config fields and `template_files` side by side) and the
 * Mimir API layout, where the config is wrapped in `alertmanager_config` as an object or YAML string.
 * The backend API expects them as two separate fields in the request body:
 *   { alertmanager_config: "<config string>", template_files: { ... } }
 *
 * This function extracts `template_files` and re-serializes the config as JSON, returning the body the
 * convert API takes.
 */
export function parseAlertmanagerYaml(yamlContent: string): AlertmanagerUserConfig {
  const parsed = loadYaml(yamlContent);

  if (!isRecord(parsed)) {
    return { alertmanager_config: yamlContent, template_files: {} };
  }

  const { template_files, ...rest } = parsed;
  const templateFiles = isStringRecord(template_files) ? template_files : {};

  if (!('alertmanager_config' in rest)) {
    return { alertmanager_config: JSON.stringify(rest), template_files: templateFiles };
  }

  const wrapped =
    typeof rest.alertmanager_config === 'string'
      ? loadYaml(rest.alertmanager_config, { embedded: true })
      : rest.alertmanager_config;
  if (!isRecord(wrapped)) {
    throw new Error(
      t(
        'alerting.import-to-gma.step1.invalid-alertmanager-config',
        'The "alertmanager_config" key must be an Alertmanager configuration object or a YAML string'
      )
    );
  }

  return { alertmanager_config: JSON.stringify(wrapped), template_files: templateFiles };
}

/**
 * Read uploaded notification template files into a { fileName: content } map, keyed by file name —
 * matching how mimirtool and the convert API key `template_files` (and how Grafana names the
 * resulting template groups). Throws if two files share the same name, since the key would be
 * ambiguous.
 */
export async function readTemplateFiles(files: File[] = []): Promise<Record<string, string>> {
  const duplicate = findDuplicateTemplateFileName(files);
  if (duplicate) {
    throw new Error(
      t('alerting.import-to-gma.templates.duplicate-file-name', 'Duplicate template file name: "{{name}}"', {
        name: duplicate,
      })
    );
  }
  const entries = await Promise.all(files.map(async (file) => [file.name, await file.text()] as const));
  return Object.fromEntries(entries);
}

/**
 * Merge separately-uploaded template files on top of any template_files already embedded in the
 * config. A name that exists in both is ambiguous, so reject it rather than silently overwriting.
 */
export function mergeTemplateFiles(
  embedded: Record<string, string>,
  uploaded: Record<string, string>
): Record<string, string> {
  for (const name of Object.keys(uploaded)) {
    if (name in embedded) {
      throw new Error(
        t(
          'alerting.import-to-gma.templates.conflicts-with-config',
          'Template file "{{name}}" conflicts with a template already defined in the config',
          { name }
        )
      );
    }
  }
  return { ...embedded, ...uploaded };
}

/**
 * Resolve the alertmanager config and template files from a YAML file or datasource, as the body the
 * convert API takes. Shared between import, dry-run, and interactive validation flows.
 */
export async function resolveAlertmanagerConfig(params: NotificationsSourceParams): Promise<AlertmanagerUserConfig> {
  const { source, datasourceName, yamlFile, templateFiles } = params;

  if (source === 'yaml' && yamlFile) {
    const yamlContent = await yamlFile.text();
    const parsed = parseAlertmanagerYaml(yamlContent);
    const uploadedTemplates = await readTemplateFiles(templateFiles);

    return {
      alertmanager_config: parsed.alertmanager_config,
      template_files: mergeTemplateFiles(parsed.template_files, uploadedTemplates),
    };
  }

  if (source === 'datasource' && datasourceName) {
    const config = await fetchAlertManagerConfig(datasourceName);
    return {
      alertmanager_config: JSON.stringify(config.alertmanager_config),
      template_files: config.template_files ?? {},
    };
  }

  throw new Error('Invalid import source configuration');
}
