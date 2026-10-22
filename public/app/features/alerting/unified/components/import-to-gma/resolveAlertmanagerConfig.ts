import { load } from 'js-yaml';

import { t } from '@grafana/i18n';

import { fetchAlertManagerConfig } from '../../api/alertmanager';

import { findDuplicateTemplateFileName } from './steps/utils';

export interface ParsedAlertmanagerYaml {
  alertmanagerConfig: string;
  templateFiles: Record<string, string>;
}

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

/**
 * Parse an Alertmanager YAML file and separate template_files from the alertmanager config.
 *
 * YAML files may contain `template_files` at the top level alongside the config fields
 * (route, receivers, templates, time_intervals, etc.). The backend API expects them
 * as two separate fields in the request body:
 *   { alertmanager_config: "<config string>", template_files: { ... } }
 *
 * This function extracts `template_files` and re-serializes the remaining config as JSON.
 */
export function parseAlertmanagerYaml(yamlContent: string): ParsedAlertmanagerYaml {
  let parsed: unknown;
  try {
    parsed = load(yamlContent);
  } catch (err) {
    // Fail locally instead of shipping invalid YAML to the backend for a generic error there.
    throw new Error(
      t('alerting.import-to-gma.step1.yaml-parse-error', 'Your YAML has a syntax error: {{message}}', {
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }

  if (!isRecord(parsed)) {
    return { alertmanagerConfig: yamlContent, templateFiles: {} };
  }

  const { template_files, ...configWithoutTemplates } = parsed;
  const templateFiles = isStringRecord(template_files) ? template_files : {};

  return {
    alertmanagerConfig: JSON.stringify(configWithoutTemplates),
    templateFiles,
  };
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
 * Resolve the alertmanager config and template files from a YAML file or datasource.
 * Shared between import, dry-run, and interactive validation flows.
 */
export async function resolveAlertmanagerConfig(params: NotificationsSourceParams): Promise<ParsedAlertmanagerYaml> {
  const { source, datasourceName, yamlFile, templateFiles } = params;

  if (source === 'yaml' && yamlFile) {
    const yamlContent = await yamlFile.text();
    const parsed = parseAlertmanagerYaml(yamlContent);
    const uploadedTemplates = await readTemplateFiles(templateFiles);

    return {
      alertmanagerConfig: parsed.alertmanagerConfig,
      templateFiles: mergeTemplateFiles(parsed.templateFiles, uploadedTemplates),
    };
  }

  if (source === 'datasource' && datasourceName) {
    const config = await fetchAlertManagerConfig(datasourceName);
    return {
      alertmanagerConfig: JSON.stringify(config.alertmanager_config),
      templateFiles: config.template_files ?? {},
    };
  }

  throw new Error('Invalid import source configuration');
}
