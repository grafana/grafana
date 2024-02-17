export type ProvisioningType = 'file' | 'api' | 'terraform';

export interface ExportProvider<TFormat> {
  name: string;
  exportFormat: TFormat;
  type: ProvisioningType;
  formatter?: (raw: string) => string;
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

export const allGrafanaExportProviders = {
  [JsonExportProvider.exportFormat]: JsonExportProvider,
  [YamlExportProvider.exportFormat]: YamlExportProvider,
  [HclExportProvider.exportFormat]: HclExportProvider,
} as const;

export const jsonAndYamlGrafanaExportProviders = [JsonExportProvider, YamlExportProvider];

export type ExportFormats = keyof typeof allGrafanaExportProviders;
