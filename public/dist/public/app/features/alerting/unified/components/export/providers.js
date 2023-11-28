export const JsonExportProvider = {
    name: 'JSON',
    exportFormat: 'json',
    formatter: (raw) => {
        try {
            return JSON.stringify(JSON.parse(raw), null, 4);
        }
        catch (e) {
            return raw;
        }
    },
};
export const YamlExportProvider = {
    name: 'YAML',
    exportFormat: 'yaml',
};
export const HclExportProvider = {
    name: 'Terraform (HCL)',
    exportFormat: 'hcl',
};
export const allGrafanaExportProviders = {
    [JsonExportProvider.exportFormat]: JsonExportProvider,
    [YamlExportProvider.exportFormat]: YamlExportProvider,
    [HclExportProvider.exportFormat]: HclExportProvider,
};
export const jsonAndYamlGrafanaExportProviders = [JsonExportProvider, YamlExportProvider];
//# sourceMappingURL=providers.js.map