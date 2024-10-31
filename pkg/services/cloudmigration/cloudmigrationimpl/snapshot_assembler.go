package cloudmigrationimpl

// Svc
type SnapshotAssembler interface {
	Builders() []SnapshotBuilder
}

// Svc Impl - OSS
type NoopSnapshotAssembler struct{}

var _ SnapshotAssembler = &NoopSnapshotAssembler{}

func (*NoopSnapshotAssembler) Builders() []SnapshotBuilder {
	return make([]SnapshotBuilder, 0)
}

// Svc Impl - Enterprise
type EnterpriseSnapshotAssembler struct {
	reportService any
}

var _ SnapshotAssembler = &EnterpriseSnapshotAssembler{}

func (sa *EnterpriseSnapshotAssembler) Builders() []SnapshotBuilder {
	assemblers := make([]SnapshotBuilder, 0)
	assemblers = append(assemblers, &ReportSnapshotBuilder{reportService: sa.reportService})
	return assemblers
}
