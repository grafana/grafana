package accesscontrol

// The LegacyCheck tests live in accesscontrol_test to avoid an import cycle
// through rbac. Export the existing fixtures only for that test binary.
type EvaluationTestCase = evaluateTestCase

var (
	PermissionEvaluateTestCases = permissionEvaluateTestCases
	AllEvaluateTestCases        = allEvaluateTestCases
	AnyEvaluateTestCases        = anyEvaluateTestCases
	CombinedEvaluateTestCases   = combinedEvaluateTestCases
)

func (tc evaluateTestCase) Description() string              { return tc.desc }
func (tc evaluateTestCase) Expected() bool                   { return tc.expected }
func (tc evaluateTestCase) Evaluator() Evaluator             { return tc.evaluator }
func (tc evaluateTestCase) Permissions() map[string][]string { return tc.permissions }

type PermissionEvaluatorForTest = permissionEvaluator
