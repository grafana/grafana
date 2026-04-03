package main

import "testing"

func TestClassify(t *testing.T) {
	tests := []struct {
		name                       string
		beOld, beNew, feOld, feNew bool
		want                       migrationStatus
		wantOK                     bool
	}{
		// No usage — skipped
		{"not used anywhere", false, false, false, false, "", false},

		// BE only
		{"BE only — not migrated", true, false, false, false, statusNotMigrated, true},
		{"BE only — migrated", false, true, false, false, statusMigrated, true},
		{"BE only — both patterns (in progress)", true, true, false, false, statusNotMigrated, true},

		// FE only
		{"FE only — not migrated", false, false, true, false, statusNotMigrated, true},
		{"FE only — migrated", false, false, false, true, statusMigrated, true},
		{"FE only — both patterns (in progress)", false, false, true, true, statusNotMigrated, true},

		// Both BE and FE
		{"both — fully migrated", false, true, false, true, statusMigrated, true},
		{"both — BE done FE not", false, true, true, false, statusPartial, true},
		{"both — FE done BE not", true, false, false, true, statusPartial, true},
		{"both — neither done", true, false, true, false, statusNotMigrated, true},
		{"both — neither done, BE in progress", true, true, true, false, statusNotMigrated, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := classify(tt.beOld, tt.beNew, tt.feOld, tt.feNew)
			if ok != tt.wantOK {
				t.Errorf("classify(beOld=%v, beNew=%v, feOld=%v, feNew=%v) ok=%v, want ok=%v",
					tt.beOld, tt.beNew, tt.feOld, tt.feNew, ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("classify(beOld=%v, beNew=%v, feOld=%v, feNew=%v) = %q, want %q",
					tt.beOld, tt.beNew, tt.feOld, tt.feNew, got, tt.want)
			}
		})
	}
}