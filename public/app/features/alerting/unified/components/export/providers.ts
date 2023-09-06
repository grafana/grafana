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

// TODO Waiting for BE changes
// const HclRuleExportProvider: RuleExportProvider<'hcl'> = {
//   name: 'HCL',
//   exportFormat: 'hcl',
// };

export const grafanaExportProviders = {
  [JsonExportProvider.exportFormat]: JsonExportProvider,
  [YamlExportProvider.exportFormat]: YamlExportProvider,
  // [HclRuleExportProvider.exportFormat]: HclRuleExportProvider,
} as const;

export type ExportFormats = keyof typeof grafanaExportProviders;
