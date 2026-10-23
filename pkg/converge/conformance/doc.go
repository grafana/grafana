// Package conformance is the executable half of converge's contract.
//
// Every guarantee the parent package claims is a property here, checked over
// generated inputs against a reference model of a target. A consumer that
// embeds converge with its own container configuration and key scheme should
// run [Check] against it: the properties hold for the planner in general, but
// a [converge.ContainerConfig] that is not a pure function of the key, or a
// fingerprint that is not content-equal, breaks them from the outside.
//
//	func TestConformance(t *testing.T) {
//		conformance.Check(t, conformance.Options{
//			Containers: myContainerConfig(),
//			Cases:      500,
//		})
//	}
//
// [Model] is also useful on its own. It applies a plan and fails on any
// violation of an ordering invariant — writing into a container that does not
// exist, removing one that still has contents — so a hand-written test can
// assert that a specific plan is safe without reimplementing the checks.
package conformance
