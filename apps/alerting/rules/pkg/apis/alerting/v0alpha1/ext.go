package v0alpha1

const (
	InternalPrefix                = "grafana.com/"
	GroupLabelKey                 = InternalPrefix + "group"
	GroupIndexLabelKey            = GroupLabelKey + "-index"
	ProvenanceStatusAnnotationKey = InternalPrefix + "provenance"
)

const (
	ProvenanceStatusNone = ""
	ProvenanceStatusAPI  = "api"
)

var (
	AcceptedProvenanceStatuses = []string{ProvenanceStatusNone, ProvenanceStatusAPI}
)
