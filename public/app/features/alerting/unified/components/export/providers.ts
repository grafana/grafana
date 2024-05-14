import { dump, loadAll } from 'js-yaml';

export type ProvisioningType = 'file' | 'api' | 'terraform' | 'operator';
export type ExportResource =
  | 'AlertRuleGroup'
  | 'AlertRule'
  | 'NotificationPolicy'
  | 'MuteTiming'
  | 'RuleFolder'
  | 'Receiver';

export interface ExportProvider<TFormat> {
  name: string;
  exportFormat: TFormat;
  type: ProvisioningType;
  formatter?: (raw: string) => string;
  overrideLanguage?: string;
  supports?: ExportResource[];
}

export const JsonExportProvider: ExportProvider<'json'> = {
  name: 'JSON',
  exportFormat: 'json',
  type: 'file',
  formatter: (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 4);
    } catch (e) {
      return raw;
    }
  },
};

export const YamlExportProvider: ExportProvider<'yaml'> = {
  name: 'YAML',
  exportFormat: 'yaml',
  type: 'file',
};

export const HclExportProvider: ExportProvider<'hcl'> = {
  name: 'Terraform (HCL)',
  exportFormat: 'hcl',
  type: 'terraform',
};

export const OperatorExportProvider: ExportProvider<'operator'> = {
  name: 'Grafana Operator',
  exportFormat: 'operator',
  overrideLanguage: 'yaml',
  type: 'operator',
  supports: ['AlertRuleGroup', 'AlertRule', 'Receiver', 'RuleFolder'],
  formatter: (raw: string) => {
    const out: Array<Record<string, unknown>> = [];
    const parsed = loadAll(raw) as Array<{ kind: string }>;
    for (const resource of parsed) {
      if (resource.kind === 'GrafanaAlertRuleGroup') {
        const r = resource as unknown as {
          spec: {
            rules: Array<Record<string, unknown>>;
          };
        };
        out.push({
          ...r,
          spec: {
            ...r.spec,
            rules: r.spec.rules.map(({ notification_settings, ...rule }) => ({
              ...rule,
              notificationSettings: notification_settings,
              for: (rule.for as string).endsWith('m') ? rule.for + '0s' : rule.for,
            })),
          },
        });
      }
      if (resource.kind === 'GrafanaContactPoint') {
        out.push({
          ...resource,
        });
      }
    }
    return out.map((r) => dump(r)).join('---\n');
  },
};

export const allGrafanaExportProviders = {
  [JsonExportProvider.exportFormat]: JsonExportProvider,
  [YamlExportProvider.exportFormat]: YamlExportProvider,
  [HclExportProvider.exportFormat]: HclExportProvider,
  [OperatorExportProvider.exportFormat]: OperatorExportProvider,
} as const;

export const jsonAndYamlGrafanaExportProviders = [JsonExportProvider, YamlExportProvider];

export type ExportFormats = keyof typeof allGrafanaExportProviders;
export const providersFor = (x: ExportResource) => {
  return Object.values(allGrafanaExportProviders).filter((provider) => provider.supports?.includes(x) ?? true);
};
