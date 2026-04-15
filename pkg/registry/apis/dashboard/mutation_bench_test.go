package dashboard

import (
	"context"
	"fmt"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/ptr"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

// createSmallDashboard creates a minimal dashboard with just title and description
func createSmallDashboard(withBOMs bool) *dashv2alpha1.Dashboard {
	title := "Test Dashboard"
	description := "Test Description"
	if withBOMs {
		title = "\ufeff" + title
		description = description + "\ufeff"
	}

	return &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-dashboard",
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title:       title,
			Description: ptr.To(description),
			Tags:        []string{},
			Links:       []dashv2alpha1.DashboardDashboardLink{},
		},
	}
}

// createMediumDashboard creates a dashboard with tags and links
func createMediumDashboard(withBOMs bool) *dashv2alpha1.Dashboard {
	title := "Medium Dashboard"
	description := "Medium Description"
	tags := []string{"tag1", "tag2", "tag3", "tag4", "tag5"}
	links := make([]dashv2alpha1.DashboardDashboardLink, 10)

	if withBOMs {
		title = "\ufeff" + title
		description = description + "\ufeff"
		for i := range tags {
			tags[i] = "\ufeff" + tags[i]
		}
	}

	for i := range links {
		linkTitle := "Link Title"
		tooltip := "Tooltip text"
		icon := "icon-name"
		if withBOMs {
			linkTitle = "\ufeff" + linkTitle
			tooltip = tooltip + "\ufeff"
			icon = "\ufeff" + icon
		}
		links[i] = dashv2alpha1.DashboardDashboardLink{
			Title:   linkTitle,
			Tooltip: tooltip,
			Icon:    icon,
		}
	}

	return &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-dashboard",
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title:       title,
			Description: ptr.To(description),
			Tags:        tags,
			Links:       links,
		},
	}
}

// createLargeDashboard creates a dashboard with many tags, links, and annotations
func createLargeDashboard(withBOMs bool) *dashv2alpha1.Dashboard {
	title := "Large Dashboard"
	description := "Large Description with more content"
	tags := make([]string, 50)
	links := make([]dashv2alpha1.DashboardDashboardLink, 50)
	annotations := make([]dashv2alpha1.DashboardAnnotationQueryKind, 20)

	if withBOMs {
		title = "\ufeff" + title
		description = description + "\ufeff"
		for i := range tags {
			tags[i] = "\ufeff" + "tag-" + string(rune('a'+i%26))
		}
	} else {
		for i := range tags {
			tags[i] = "tag-" + string(rune('a'+i%26))
		}
	}

	for i := range links {
		linkTitle := "Link Title " + string(rune('0'+i%10))
		tooltip := "Tooltip text for link"
		icon := "icon-name-" + string(rune('0'+i%10))
		if withBOMs {
			linkTitle = "\ufeff" + linkTitle
			tooltip = tooltip + "\ufeff"
			icon = "\ufeff" + icon
		}
		links[i] = dashv2alpha1.DashboardDashboardLink{
			Title:   linkTitle,
			Tooltip: tooltip,
			Icon:    icon,
		}
	}

	for i := range annotations {
		name := "Annotation " + string(rune('0'+i%10))
		if withBOMs {
			name = "\ufeff" + name
		}
		annotations[i] = dashv2alpha1.DashboardAnnotationQueryKind{
			Kind: "AnnotationQuery",
			Spec: dashv2alpha1.DashboardAnnotationQuerySpec{
				Name: name,
			},
		}
	}

	return &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-dashboard",
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title:       title,
			Description: ptr.To(description),
			Tags:        tags,
			Links:       links,
			Annotations: annotations,
		},
	}
}

// Benchmark small dashboard without BOMs
func BenchmarkMutate_SmallDashboard_NoBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Create fresh dashboard for each iteration
		dashboard := createSmallDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark small dashboard with BOMs
func BenchmarkMutate_SmallDashboard_WithBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createSmallDashboard(true)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark medium dashboard without BOMs
func BenchmarkMutate_MediumDashboard_NoBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createMediumDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark medium dashboard with BOMs
func BenchmarkMutate_MediumDashboard_WithBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createMediumDashboard(true)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark large dashboard without BOMs
func BenchmarkMutate_LargeDashboard_NoBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createLargeDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark large dashboard with BOMs
func BenchmarkMutate_LargeDashboard_WithBOMs(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createLargeDashboard(true)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark the util.StripBOMFromStruct function directly on dashboard specs
func BenchmarkStripBOMFromStruct_DashboardSmall(b *testing.B) {
	spec := createSmallDashboard(true).Spec

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		util.StripBOMFromStruct(&spec)
	}
}

func BenchmarkStripBOMFromStruct_DashboardMedium(b *testing.B) {
	spec := createMediumDashboard(true).Spec

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		util.StripBOMFromStruct(&spec)
	}
}

func BenchmarkStripBOMFromStruct_DashboardLarge(b *testing.B) {
	spec := createLargeDashboard(true).Spec

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		util.StripBOMFromStruct(&spec)
	}
}

// Benchmark without BOM stripping to measure baseline overhead
func BenchmarkMutate_SmallDashboard_NoStripping(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features:         featuremgmt.WithFeatures(),
		skipBOMStripping: true, // Skip BOM stripping for baseline
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createSmallDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

func BenchmarkMutate_MediumDashboard_NoStripping(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features:         featuremgmt.WithFeatures(),
		skipBOMStripping: true,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createMediumDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

func BenchmarkMutate_LargeDashboard_NoStripping(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features:         featuremgmt.WithFeatures(),
		skipBOMStripping: true,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dashboard := createLargeDashboard(false)
		attrs := admission.NewAttributesRecord(
			dashboard,
			nil,
			dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
			"",
			"test",
			dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
		_ = builder.Mutate(context.Background(), attrs, nil)
	}
}

// Benchmark processing N dashboards to measure throughput
func BenchmarkMutate_BatchDashboards(b *testing.B) {
	builder := &DashboardsAPIBuilder{
		features: featuremgmt.WithFeatures(),
	}

	dashboardCounts := []int{10, 100, 1000}

	for _, count := range dashboardCounts {
		b.Run(fmt.Sprintf("%d_small_dashboards", count), func(b *testing.B) {
			// Pre-create dashboards
			dashboards := make([]*dashv2alpha1.Dashboard, count)
			for i := 0; i < count; i++ {
				dashboards[i] = createSmallDashboard(true)
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for _, dashboard := range dashboards {
					attrs := admission.NewAttributesRecord(
						dashboard,
						nil,
						dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
						"",
						"test",
						dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
						"",
						admission.Create,
						&metav1.CreateOptions{},
						false,
						nil,
					)
					_ = builder.Mutate(context.Background(), attrs, nil)
				}
			}
		})

		b.Run(fmt.Sprintf("%d_medium_dashboards", count), func(b *testing.B) {
			dashboards := make([]*dashv2alpha1.Dashboard, count)
			for i := 0; i < count; i++ {
				dashboards[i] = createMediumDashboard(true)
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for _, dashboard := range dashboards {
					attrs := admission.NewAttributesRecord(
						dashboard,
						nil,
						dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
						"",
						"test",
						dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
						"",
						admission.Create,
						&metav1.CreateOptions{},
						false,
						nil,
					)
					_ = builder.Mutate(context.Background(), attrs, nil)
				}
			}
		})

		b.Run(fmt.Sprintf("%d_large_dashboards", count), func(b *testing.B) {
			dashboards := make([]*dashv2alpha1.Dashboard, count)
			for i := 0; i < count; i++ {
				dashboards[i] = createLargeDashboard(true)
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				for _, dashboard := range dashboards {
					attrs := admission.NewAttributesRecord(
						dashboard,
						nil,
						dashv2alpha1.DashboardResourceInfo.GroupVersionKind(),
						"",
						"test",
						dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
						"",
						admission.Create,
						&metav1.CreateOptions{},
						false,
						nil,
					)
					_ = builder.Mutate(context.Background(), attrs, nil)
				}
			}
		})
	}
}
