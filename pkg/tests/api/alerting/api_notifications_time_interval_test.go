package alerting

import (
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func TestTimeInterval(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	t.Run("default config should return empty list", func(t *testing.T) {
		mt, status, body := apiClient.GetAllTimeIntervalsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Empty(t, mt)
	})

	emptyTimeInterval := definitions.PostableTimeIntervals{
		Name:          "Empty Mute Timing",
		TimeIntervals: []definitions.TimeIntervalItem{},
	}

	func() {
		// TODO replace with Time-Interval later
		emptyMuteTiming := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name:          "Empty Mute Timing",
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}

		// TODO replace with create interval API
		// t.Run("should create a new mute timing without any intervals", func(t *testing.T) {
		mt, status, body := apiClient.CreateMuteTimingWithStatus(t, emptyMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
		// })

		anotherMuteTiming := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "Not Empty Mute Timing",
				TimeIntervals: []timeinterval.TimeInterval{
					{
						Times: []timeinterval.TimeRange{
							{
								StartMinute: 10,
								EndMinute:   45,
							},
						},
						Weekdays: []timeinterval.WeekdayRange{
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 0,
									End:   2,
								},
							},
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 4,
									End:   5,
								},
							},
						},
						DaysOfMonth: []timeinterval.DayOfMonthRange{
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 1,
									End:   7,
								},
							},
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 14,
									End:   28,
								},
							},
						},
						Months: []timeinterval.MonthRange{
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 1,
									End:   5,
								},
							},
						},
						Years: []timeinterval.YearRange{
							{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 2024,
									End:   2025,
								},
							},
						},
						Location: &timeinterval.Location{
							Location: time.UTC,
						},
					},
				},
			},
		}

		// t.Run("should create a new mute timing with some settings", func(t *testing.T) {
		mt, status, body = apiClient.CreateMuteTimingWithStatus(t, anotherMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
		// })
	}()

	anotherTimeInterval := definitions.PostableTimeIntervals{
		Name: "Not Empty Mute Timing",
		TimeIntervals: []definitions.TimeIntervalItem{
			{
				Times: []definitions.TimeIntervalTimeRange{
					{
						StartMinute: "00:10",
						EndMinute:   "00:45",
					},
				},
				Weekdays: util.Pointer([]string{
					"sunday:tuesday",
					"thursday:friday",
				}),
				DaysOfMonth: util.Pointer([]string{
					"1:7",
					"14:28",
				}),
				Months: util.Pointer([]string{
					"1:5",
				}),
				Years: util.Pointer([]string{
					"2024:2025",
				}),
				Location: util.Pointer("UTC"),
			},
		},
	}

	t.Run("should return time interval by name", func(t *testing.T) {
		ti, status, body := apiClient.GetTimeIntervalByNameWithStatus(t, emptyTimeInterval.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, emptyTimeInterval.TimeIntervals, ti.TimeIntervals)
		require.Equal(t, emptyTimeInterval.Name, ti.Name)
		require.EqualValues(t, models.ProvenanceAPI, ti.Provenance)

		ti, status, body = apiClient.GetTimeIntervalByNameWithStatus(t, anotherTimeInterval.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, anotherTimeInterval.TimeIntervals, ti.TimeIntervals)
		require.Equal(t, anotherTimeInterval.Name, ti.Name)
		require.EqualValues(t, models.ProvenanceAPI, ti.Provenance)
	})

	t.Run("should return NotFound if time interval does not exist", func(t *testing.T) {
		_, status, body := apiClient.GetTimeIntervalByNameWithStatus(t, "some-missing-timing")
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should return all mute timings", func(t *testing.T) {
		mt, status, body := apiClient.GetAllTimeIntervalsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Len(t, mt, 2)

		slices.SortFunc(mt, func(a, b definitions.GettableTimeIntervals) int {
			return strings.Compare(a.Name, b.Name)
		})

		require.Equal(t, emptyTimeInterval.TimeIntervals, mt[0].TimeIntervals)
		require.Equal(t, emptyTimeInterval.Name, mt[0].Name)
		require.EqualValues(t, models.ProvenanceAPI, mt[0].Provenance)

		require.Equal(t, anotherTimeInterval.TimeIntervals, mt[1].TimeIntervals)
		require.Equal(t, anotherTimeInterval.Name, mt[1].Name)
		require.EqualValues(t, models.ProvenanceAPI, mt[1].Provenance)
	})
}
