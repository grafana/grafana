package models

type OrgMigrationSummary struct {
	NewDashboards int
	NewAlerts     int
	NewChannels   int
	Removed       bool
	HasErrors     bool
}

func (s *OrgMigrationSummary) Add(other OrgMigrationSummary) {
	s.NewDashboards += other.NewDashboards
	s.NewAlerts += other.NewAlerts
	s.NewChannels += other.NewChannels
	s.Removed = s.Removed || other.Removed
	s.HasErrors = s.HasErrors || other.HasErrors
}

func (s *OrgMigrationSummary) CountDashboardAlerts(pairs ...*AlertPair) {
	if len(pairs) > 0 {
		s.NewDashboards += 1
	}
	if s.HasErrors {
		s.NewAlerts += len(pairs)
		return
	}
	s.NewAlerts += len(pairs)
	for _, pair := range pairs {
		if pair.Error != "" {
			s.HasErrors = true
			break
		}
	}
}

func (s *OrgMigrationSummary) CountChannels(pairs ...*ContactPair) {
	if s.HasErrors {
		s.NewChannels += len(pairs)
		return
	}
	s.NewChannels += len(pairs)
	for _, pair := range pairs {
		if pair.Error != "" {
			s.HasErrors = true
			break
		}
	}
}
