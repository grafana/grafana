package v0alpha1

const (
	InternalPrefix                = "grafana.app/"
	GroupLabelKey                 = InternalPrefix + "group"
	GroupIndexLabelKey            = GroupLabelKey + "-index"
	ProvenanceStatusAnnotationKey = InternalPrefix + "provenance"
	ProvenanceStatusNone          = "none"
)
