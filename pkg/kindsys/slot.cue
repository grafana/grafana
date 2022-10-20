package kindsys

// Slot is a structured kind category that provides schema elements for
// composition into CoreStructured and CustomStructured kinds. Grafana plugins
// provide SlotKinds; for example, a datasource plugin provides a SlotKind to
// describe the structure of its queries, which is then composed into dashboards
// and alerting rules.
//
// Each SlotKind is an implementation of exactly one Slot, a shared meta-schema
// defined by Grafana itself that constrains the shape of schemas declared in
// that SlotKind.
#Slot: {
	_sharedKind
	form: "structured"

	maturity: *"experimental" | "mature"
}
