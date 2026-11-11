package auth

func WithoutFallback(c AccessChecker) AccessChecker {
	switch v := c.(type) {
	case *verbAwareAccessChecker:
		return &verbAwareAccessChecker{read: WithoutFallback(v.read), write: WithoutFallback(v.write)}
	case *sessionAccessChecker:
		return v.WithFallbackRole("")
	}
	return c
}
