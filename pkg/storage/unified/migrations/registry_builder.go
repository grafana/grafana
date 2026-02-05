package migrations

// ProvideMigrationRegistry is a Wire provider that creates a MigrationRegistry
// from all available MigrationRegistrars. Each registrar independently registers
// its own migrations, allowing teams to own their migration definitions.
func ProvideMigrationRegistry(registrars []MigrationRegistrar) *MigrationRegistry {
	r := NewMigrationRegistry()
	for _, reg := range registrars {
		reg.RegisterMigrations(r)
	}
	return r
}

/*
BuildMigrationRegistry is a convenience function that creates a fully populated
MigrationRegistry from the provided registrars. This is useful for CLI tools
and tests that don't use Wire dependency injection.
For the Wire-based server startup path, use ProvideMigrationRegistry instead.
*/
func BuildMigrationRegistry(registrars ...MigrationRegistrar) *MigrationRegistry {
	return ProvideMigrationRegistry(registrars)
}
