package kindsys

import "github.com/grafana/thema"

// Composable is a category of structured kind that provides schema elements for
// composition into CoreStructured and CustomStructured kinds. Grafana plugins
// provide composable kinds; for example, a datasource plugin provides one to
// describe the structure of its queries, which is then composed into dashboards
// and alerting rules.
//
// Each Composable is an implementation of exactly one Slot, a shared meta-schema
// defined by Grafana itself that constrains the shape of schemas declared in
// that ComposableKind.
#Composable: S={
	_sharedKind
	form: "structured"

	// lineage is the Thema lineage containing all the schemas that have existed for this kind.
	// It is required that lineage.name is the same as the [machineName].
	lineage: thema.#Lineage & { name: S.machineName }

	maturity: *"experimental" | "mature"
}
