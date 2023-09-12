interface ExportProvider<TFormat> {
  name: string;
  exportFormat: TFormat;
  formatter?: (raw: string) => string;
}

const JsonExportProvider: ExportProvider<'json'> = {
  name: 'JSON',
  exportFormat: 'json',
  formatter: (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 4);
    } catch (e) {
      return raw;
    }
  },
};

const YamlExportProvider: ExportProvider<'yaml'> = {
  name: 'YAML',
  exportFormat: 'yaml',
};

const HclExportProvider: ExportProvider<'hcl'> = {
  name: 'Terraform (HCL)',
  exportFormat: 'hcl',
};

export const grafanaExportProviders = {
  [JsonExportProvider.exportFormat]: JsonExportProvider,
  [YamlExportProvider.exportFormat]: YamlExportProvider,
   [HclExportProvider.exportFormat]: HclExportProvider,
} as const;

export const grafanaExportProvidersWithoutHCL = {
  [JsonExportProvider.exportFormat]: JsonExportProvider,
  [YamlExportProvider.exportFormat]: YamlExportProvider,
} as const;

export type ExportFormats = keyof typeof grafanaExportProviders;
export type ExportFormatsWithoutHCL = keyof typeof grafanaExportProvidersWithoutHCL;
