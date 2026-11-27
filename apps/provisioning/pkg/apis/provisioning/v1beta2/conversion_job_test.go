package v1beta2

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/randfill"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const jobFuzzIterations = 500

func newJobTestScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	s := runtime.NewScheme()
	require.NoError(t, v0alpha1.AddToScheme(s))
	require.NoError(t, AddToScheme(s))
	require.NoError(t, RegisterJobConversions(s))
	return s
}

// v0alpha1Filler fills every field v0alpha1 can hold, except values v1beta2 rejects
// or canonicalizes: ints beyond int32 and nil summary entries.
func v0alpha1Filler(seed int64) *randfill.Filler {
	return randfill.NewWithSeed(seed).NilChance(0.2).NumElements(0, 3).Funcs(
		func(m *metav1.TypeMeta, _ randfill.Continue) { *m = metav1.TypeMeta{} },
		func(o *v0alpha1.PullRequestJobOptions, c randfill.Continue) {
			c.FillNoCustom(o)
			o.PR = int(int32(o.PR))
		},
		func(o *v0alpha1.TestJobOptions, c randfill.Continue) {
			c.FillNoCustom(o)
			o.ProgressUpdates = int(int32(o.ProgressUpdates))
		},
		func(s *[]*v0alpha1.JobResourceSummary, c randfill.Continue) {
			c.FillNoCustom(s)
			for i := range *s {
				if (*s)[i] == nil {
					(*s)[i] = &v0alpha1.JobResourceSummary{}
				}
			}
		},
	)
}

// canonicalV1beta2Filler fills v1beta2 objects in canonical form: optional pointers
// are either nil or point to a non-zero value, and durations use time.Duration.String.
// IsFork is the one optional bool that keeps false.
func canonicalV1beta2Filler(seed int64) *randfill.Filler {
	return randfill.NewWithSeed(seed).NilChance(0.2).NumElements(0, 3).Funcs(
		func(m *metav1.TypeMeta, _ randfill.Continue) { *m = metav1.TypeMeta{} },
		func(p **string, c randfill.Continue) { *p = jobNonZero(c.String(0)) },
		func(p **int32, c randfill.Continue) { *p = jobNonZero(c.Int31()) },
		func(p **int64, c randfill.Continue) { *p = jobNonZero(c.Int63()) },
		func(p **float64, c randfill.Continue) { *p = jobNonZero(c.Float64()) },
		func(p **bool, c randfill.Continue) { *p = jobNonZero(c.Bool()) },
		func(p **JobState, c randfill.Continue) { *p = jobNonZero(JobState(c.String(0))) },
		func(p **HistoricJobState, c randfill.Continue) { *p = jobNonZero(HistoricJobState(c.String(0))) },
		func(o *JobPullRequestJobOptions, c randfill.Continue) {
			c.FillNoCustom(o)
			canonicalPullRequestOptions(o, c)
		},
		func(o *HistoricJobPullRequestJobOptions, c randfill.Continue) {
			c.FillNoCustom(o)
			canonicalPullRequestOptions((*JobPullRequestJobOptions)(o), c)
		},
		func(o *JobTestJobOptions, c randfill.Continue) { canonicalTestOptions(o, c) },
		func(o *HistoricJobTestJobOptions, c randfill.Continue) {
			canonicalTestOptions((*JobTestJobOptions)(o), c)
		},
	)
}

func canonicalPullRequestOptions(o *JobPullRequestJobOptions, c randfill.Continue) {
	*o = JobPullRequestJobOptions{
		Ref:     jobNonZero(c.String(0)),
		Pr:      jobNonZero(c.Int31()),
		Hash:    jobNonZero(c.String(0)),
		Url:     jobNonZero(c.String(0)),
		ForkURL: jobNonZero(c.String(0)),
	}
	if c.Bool() {
		o.IsFork = new(c.Bool())
	}
}

func canonicalTestOptions(o *JobTestJobOptions, c randfill.Continue) {
	*o = JobTestJobOptions{ProgressUpdates: jobNonZero(c.Int31())}
	if d := time.Duration(c.Int63()); d != 0 && c.Bool() {
		o.Duration = new(d.String())
	}
}

func TestJobConversion_V0alpha1RoundTrip(t *testing.T) {
	s := newJobTestScheme(t)
	for seed := range int64(jobFuzzIterations) {
		f := v0alpha1Filler(seed)

		in := &v0alpha1.Job{}
		f.Fill(in)
		mid, back := &Job{}, &v0alpha1.Job{}
		require.NoError(t, s.Convert(in, mid, nil))
		require.NoError(t, s.Convert(mid, back, nil))
		require.Equal(t, in, back, "seed %d", seed)

		inHistoric := &v0alpha1.HistoricJob{}
		f.Fill(inHistoric)
		midHistoric, backHistoric := &HistoricJob{}, &v0alpha1.HistoricJob{}
		require.NoError(t, s.Convert(inHistoric, midHistoric, nil))
		require.NoError(t, s.Convert(midHistoric, backHistoric, nil))
		require.Equal(t, inHistoric, backHistoric, "seed %d", seed)

		inList := &v0alpha1.JobList{}
		f.Fill(inList)
		midList, backList := &JobList{}, &v0alpha1.JobList{}
		require.NoError(t, s.Convert(inList, midList, nil))
		require.NoError(t, s.Convert(midList, backList, nil))
		require.Equal(t, inList, backList, "seed %d", seed)

		inHistoricList := &v0alpha1.HistoricJobList{}
		f.Fill(inHistoricList)
		midHistoricList, backHistoricList := &HistoricJobList{}, &v0alpha1.HistoricJobList{}
		require.NoError(t, s.Convert(inHistoricList, midHistoricList, nil))
		require.NoError(t, s.Convert(midHistoricList, backHistoricList, nil))
		require.Equal(t, inHistoricList, backHistoricList, "seed %d", seed)
	}
}

func TestJobConversion_CanonicalV1beta2RoundTrip(t *testing.T) {
	s := newJobTestScheme(t)
	for seed := range int64(jobFuzzIterations) {
		f := canonicalV1beta2Filler(seed)

		in := &Job{}
		f.Fill(in)
		mid, back := &v0alpha1.Job{}, &Job{}
		require.NoError(t, s.Convert(in, mid, nil))
		require.NoError(t, s.Convert(mid, back, nil))
		require.Equal(t, in, back, "seed %d", seed)

		inHistoric := &HistoricJob{}
		f.Fill(inHistoric)
		midHistoric, backHistoric := &v0alpha1.HistoricJob{}, &HistoricJob{}
		require.NoError(t, s.Convert(inHistoric, midHistoric, nil))
		require.NoError(t, s.Convert(midHistoric, backHistoric, nil))
		require.Equal(t, inHistoric, backHistoric, "seed %d", seed)

		inList := &JobList{}
		f.Fill(inList)
		midList, backList := &v0alpha1.JobList{}, &JobList{}
		require.NoError(t, s.Convert(inList, midList, nil))
		require.NoError(t, s.Convert(midList, backList, nil))
		require.Equal(t, inList, backList, "seed %d", seed)

		inHistoricList := &HistoricJobList{}
		f.Fill(inHistoricList)
		midHistoricList, backHistoricList := &v0alpha1.HistoricJobList{}, &HistoricJobList{}
		require.NoError(t, s.Convert(inHistoricList, midHistoricList, nil))
		require.NoError(t, s.Convert(midHistoricList, backHistoricList, nil))
		require.Equal(t, inHistoricList, backHistoricList, "seed %d", seed)
	}
}

func TestJobConversion_JobSpecRoundTrip(t *testing.T) {
	s := newJobTestScheme(t)
	for seed := range int64(jobFuzzIterations) {
		in := &v0alpha1.JobSpec{}
		v0alpha1Filler(seed).Fill(in)
		mid, back := &JobSpec{}, &v0alpha1.JobSpec{}
		require.NoError(t, s.Convert(in, mid, nil))
		require.NoError(t, s.Convert(mid, back, nil))
		require.Equal(t, in, back, "seed %d", seed)
	}
}

// The JSON a v0alpha1 client sees must be the JSON a v1beta2 client sees, apart from apiVersion.
func TestJobConversion_JSONMatchesV0alpha1(t *testing.T) {
	spec := `{
		"action": "pr",
		"repository": "repo",
		"message": "msg",
		"pr": {"ref": "main", "pr": 12, "hash": "abc", "url": "https://example.com/pr/12", "isFork": false, "forkURL": "https://example.com/fork"},
		"push": {"message": "m", "folder": "f", "branch": "b", "path": "p", "resources": [{"name": "d", "kind": "Dashboard", "group": "dashboard.grafana.app"}], "generateNewFolderIDs": true},
		"pull": {"incremental": false},
		"migrate": {"message": "m", "branch": "b", "resources": [{"name": "d"}], "generateNewFolderIDs": true, "skipResourceDeletion": true},
		"delete": {"ref": "r", "paths": ["a.json", "nested/"], "resources": [{"kind": "Folder"}]},
		"move": {"ref": "r", "paths": ["a.json"], "targetPath": "new/", "resources": [{"group": "folder.grafana.app"}]},
		"fixFolderMetadata": {"ref": "r"},
		"test": {"duration": "1m30s", "progressUpdates": 4}
	}`
	status := `{
		"state": "warning",
		"started": 1700000000000,
		"finished": 1700000001000,
		"message": "done",
		"errors": ["e"],
		"warnings": ["w"],
		"progress": 50.5,
		"progressUpdates": 7,
		"summary": [{"group": "dashboard.grafana.app", "kind": "Dashboard", "total": 3, "create": 1, "update": 1, "delete": 1, "write": 2, "error": 1, "warning": 1, "noop": 1, "totalChanges": 3, "errors": ["e"], "warnings": ["w"]}, {}],
		"url": {"repositoryURL": "https://example.com", "sourceURL": "https://example.com/s", "newPullRequestURL": "https://example.com/n", "compareURL": "https://example.com/c"}
	}`
	metadata := `{"name": "job-1", "namespace": "default", "labels": {"provisioning.grafana.app/repository": "repo"}}`

	for _, kind := range []string{"Job", "HistoricJob"} {
		t.Run(kind, func(t *testing.T) {
			s := newJobTestScheme(t)
			v0JSON := `{"apiVersion": "provisioning.grafana.app/v0alpha1", "kind": "` + kind + `", "metadata": ` + metadata + `, "spec": ` + spec + `, "status": ` + status + `}`
			v1beta2JSON := `{"apiVersion": "provisioning.grafana.app/v1beta2", "kind": "` + kind + `", "metadata": ` + metadata + `, "spec": ` + spec + `, "status": ` + status + `}`

			v0Obj, err := s.New(v0alpha1.SchemeGroupVersion.WithKind(kind))
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal([]byte(v0JSON), v0Obj))

			v1beta2Obj, err := s.New(GroupVersion.WithKind(kind))
			require.NoError(t, err)
			require.NoError(t, s.Convert(v0Obj, v1beta2Obj, nil))
			v1beta2Obj.GetObjectKind().SetGroupVersionKind(GroupVersion.WithKind(kind))
			got, err := json.Marshal(v1beta2Obj)
			require.NoError(t, err)
			require.JSONEq(t, v1beta2JSON, string(got))

			back, err := s.New(v0alpha1.SchemeGroupVersion.WithKind(kind))
			require.NoError(t, err)
			require.NoError(t, s.Convert(v1beta2Obj, back, nil))
			back.GetObjectKind().SetGroupVersionKind(v0alpha1.SchemeGroupVersion.WithKind(kind))
			got, err = json.Marshal(back)
			require.NoError(t, err)
			require.JSONEq(t, v0JSON, string(got))
		})
	}
}

func TestJobConversion_NilSummaryEntryBecomesEmpty(t *testing.T) {
	in := &v0alpha1.Job{Status: v0alpha1.JobStatus{Summary: []*v0alpha1.JobResourceSummary{nil, {Kind: "Dashboard"}}}}
	out := &Job{}
	require.NoError(t, Convert_v0alpha1_Job_To_v1beta2_Job(in, out, nil))
	require.Equal(t, []JobResourceSummary{{}, {Kind: new("Dashboard")}}, out.Status.Summary)
}

func TestJobConversion_Errors(t *testing.T) {
	s := newJobTestScheme(t)
	tests := []struct {
		name    string
		in      runtime.Object
		out     runtime.Object
		wantErr string
	}{
		{
			name:    "pr number beyond int32",
			in:      &v0alpha1.Job{Spec: v0alpha1.JobSpec{PullRequest: &v0alpha1.PullRequestJobOptions{PR: math.MaxInt32 + 1}}},
			out:     &Job{},
			wantErr: "spec.pr.pr: 2147483648 does not fit in int32",
		},
		{
			name:    "progress updates beyond int32",
			in:      &v0alpha1.HistoricJob{Spec: v0alpha1.JobSpec{Test: &v0alpha1.TestJobOptions{ProgressUpdates: math.MinInt32 - 1}}},
			out:     &HistoricJob{},
			wantErr: "spec.test.progressUpdates: -2147483649 does not fit in int32",
		},
		{
			name:    "unparsable duration",
			in:      &Job{Spec: JobSpec{Test: &JobTestJobOptions{Duration: new("soon")}}},
			out:     &v0alpha1.Job{},
			wantErr: `spec.test.duration: time: invalid duration "soon"`,
		},
		{
			name:    "list item error carries its index",
			in:      &HistoricJobList{Items: []HistoricJob{{}, {Spec: HistoricJobSpec{Test: &HistoricJobTestJobOptions{Duration: new("later")}}}}},
			out:     &v0alpha1.HistoricJobList{},
			wantErr: `items[1]: spec.test.duration: time: invalid duration "later"`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.EqualError(t, s.Convert(tt.in, tt.out, nil), tt.wantErr)
		})
	}
}
