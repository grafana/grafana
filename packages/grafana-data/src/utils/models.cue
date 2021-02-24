package grafanaschema

RegistryItem: {
    id: string // Unique Key -- saved in configs
    name: string // Display Name, can change without breaking configs
    description?: string
    aliasIds?: [...string] // when the ID changes, we may want backwards compatibility ('current' => 'last')
    excludeFromPicker?: bool // Some extensions should not be user selectable like: 'all' and 'any' matchers;
} @cuetsy(targetType="interface")