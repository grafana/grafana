package eval

type evaluateTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	permissions map[string]map[string]struct{}
}

type injectTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	params      map[string]string
	permissions map[string]map[string]struct{}
}

type failedTestCase struct {
	desc        string
	failed      int
	evaluator   Evaluator
	permissions map[string]map[string]struct{}
}
