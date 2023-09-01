interface RuleExportProvider<TFormat> {
  name: string;
  exportFormat: TFormat;
  formatter?: (raw: string) => string;
}

const JsonRuleExportProvider: RuleExportProvider<'json'> = {
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

const YamlRuleExportProvider: RuleExportProvider<'yaml'> = {
  name: 'YAML',
  exportFormat: 'yaml',
};

const HclRuleExportProvider: RuleExportProvider<'hcl'> = {
  name: 'HCL',
  exportFormat: 'hcl',
};

export const grafanaRuleExportProviders = {
  [JsonRuleExportProvider.exportFormat]: JsonRuleExportProvider,
  [YamlRuleExportProvider.exportFormat]: YamlRuleExportProvider,
  [HclRuleExportProvider.exportFormat]: HclRuleExportProvider,
} as const;

export type RuleExportFormats = keyof typeof grafanaRuleExportProviders;
