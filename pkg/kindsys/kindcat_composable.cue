package kindsys

// Composable is a category of kind that provides schema elements for
// composition into Core and Custom kinds. Grafana plugins
// provide composable kinds; for example, a datasource plugin provides one to
// describe the structure of its queries, which is then composed into dashboards
// and alerting rules.
//
// Each Composable is an implementation of exactly one Slot, a shared meta-schema
// defined by Grafana itself that constrains the shape of schemas defined in
// that ComposableKind.
Composable: S={
	_sharedKind

	// schemaInterface is the name of the Grafana schema interface implemented by
	// this Composable kind. The set is open to ensure forward compatibility of
	// Grafana and tooling with any additional schema interfaces that may be added.
	schemaInterface: string
	// TODO is it worth doing something like below, given that we have to keep this set open for forward compatibility?
//	schemaInterface: or([ for k, _ in schemaInterfaces {k}, string])

	let schif = schemaInterfaces[S.schemaInterface]

	// lineage is the Thema lineage containing all the schemas that have existed for this kind.
	// The name of the lineage is constrained to the name of the schema interface being implemented.
// FIXME cuetsy currently gets confused by all the unifications - maybe openapi too. Do something like the following after thema separates joinSchema/constraint expression
//	lineage: { joinSchema: schif.interface }
//	lineage: { joinSchema: (schif.interface | *{}) }

	lineageIsGroup: schif.group
}
