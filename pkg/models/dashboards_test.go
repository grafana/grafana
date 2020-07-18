package models

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardModel(t *testing.T) {
	Convey("Generate full dashboard url", t, func() {
		setting.AppUrl = "http://grafana.local/"
		fullUrl := GetFullDashboardUrl("uid", "my-dashboard")
		So(fullUrl, ShouldEqual, "http://grafana.local/d/uid/my-dashboard")
	})

	Convey("Generate relative dashboard url", t, func() {
		setting.AppUrl = ""
		fullUrl := GetDashboardUrl("uid", "my-dashboard")
		So(fullUrl, ShouldEqual, "/d/uid/my-dashboard")
	})

	Convey("When generating slug", t, func() {
		dashboard := NewDashboard("Grafana Play Home")
		dashboard.UpdateSlug()

		So(dashboard.Slug, ShouldEqual, "grafana-play-home")
	})

	Convey("Can slugify titles", t, func() {
		tests := map[string]string{
			"Grafana Play Home": "grafana-play-home",
			"snöräv-över-ån":    "snorav-over-an",
			"漢字":                "han-zi",      // Hanzi for hanzi
			"🇦🇶":                "8J-HpvCfh7Y", // flag of Antarctica-emoji, using fallback
			"𒆠":                 "8JKGoA",      // cuneiform Ki, using fallback
		}

		for input, expected := range tests {
			slug := SlugifyTitle(input)

			So(slug, ShouldEqual, expected)
		}
	})

	Convey("Given a dashboard json", t, func() {
		json := simplejson.New()
		json.Set("title", "test dash")

		Convey("With tags as string value", func() {
			json.Set("tags", "")
			dash := NewDashboardFromJson(json)

			So(len(dash.GetTags()), ShouldEqual, 0)
		})
	})

	Convey("Given a new dashboard folder", t, func() {
		json := simplejson.New()
		json.Set("title", "test dash")

		cmd := &SaveDashboardCommand{Dashboard: json, IsFolder: true}
		dash := cmd.GetDashboardModel()

		Convey("Should set IsFolder to true", func() {
			So(dash.IsFolder, ShouldBeTrue)
		})
	})

	Convey("Given a child dashboard", t, func() {
		json := simplejson.New()
		json.Set("title", "test dash")

		cmd := &SaveDashboardCommand{Dashboard: json, FolderId: 1}
		dash := cmd.GetDashboardModel()

		Convey("Should set FolderId", func() {
			So(dash.FolderId, ShouldEqual, 1)
		})
	})
}
