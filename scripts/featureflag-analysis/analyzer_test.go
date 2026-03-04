package main

import "testing"

func TestClassify(t *testing.T) {
	tests := []struct {
		name                    string
		beOld, beNew, feOld, feNew bool
		want                    migrationStatus
	}{
		// No usage
		{"not used anywhere", false, false, false, false, statusNoUsage},

		// BE only
		{"BE only — not migrated", true, false, false, false, statusNotMigrated},
		{"BE only — migrated", false, true, false, false, statusMigrated},
		{"BE only — both patterns (in progress)", true, true, false, false, statusNotMigrated},

		// FE only
		{"FE only — not migrated", false, false, true, false, statusNotMigrated},
		{"FE only — migrated", false, false, false, true, statusMigrated},
		{"FE only — both patterns (in progress)", false, false, true, true, statusNotMigrated},

		// Both BE and FE
		{"both — fully migrated", false, true, false, true, statusMigrated},
		{"both — BE done FE not", false, true, true, false, statusPartial},
		{"both — FE done BE not", true, false, false, true, statusPartial},
		{"both — neither done", true, false, true, false, statusNotMigrated},
		{"both — neither done, BE in progress", true, true, true, false, statusNotMigrated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classify(tt.beOld, tt.beNew, tt.feOld, tt.feNew)
			if got != tt.want {
				t.Errorf("classify(beOld=%v, beNew=%v, feOld=%v, feNew=%v) = %q, want %q",
					tt.beOld, tt.beNew, tt.feOld, tt.feNew, got, tt.want)
			}
		})
	}
}
