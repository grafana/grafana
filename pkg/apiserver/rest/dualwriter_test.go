package rest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
)

var now = time.Now()

var exampleObj = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo", ResourceVersion: "1", CreationTimestamp: metav1.Time{}, GenerateName: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: now}}}

func TestCompare(t *testing.T) {
	var exampleObjGen1 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 1}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjGen2 = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjGen3 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "pod", APIVersion: "pods/v0"}, ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "one"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}
	var exampleObjDifferentTitle = &example.Pod{ObjectMeta: metav1.ObjectMeta{Generation: 2}, Spec: example.PodSpec{Hostname: "two"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Unix(0, 0)}}}

	testCase := []struct {
		name     string
		input1   runtime.Object
		input2   runtime.Object
		expected bool
	}{
		{
			name:     "should return true when both objects are the same",
			input1:   exampleObj,
			input2:   exampleObj,
			expected: true,
		},
		{
			name:     "should return true when objects are the same, but different metadata (generation)",
			input1:   exampleObjGen1,
			input2:   exampleObjGen2,
			expected: true,
		},
		{
			name:     "should return true when objects are the same, but different TypeMeta (kind and apiversion)",
			input1:   exampleObjGen1,
			input2:   exampleObjGen3,
			expected: true,
		},
		{
			name:     "should return false when objects are different",
			input1:   exampleObjGen1,
			input2:   exampleObjDifferentTitle,
			expected: false,
		},
	}
	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, Compare(tt.input1, tt.input2))
		})
	}
}
