package exitcodes

const (
	Success              = 0
	IssuesFound          = 1
	WarningInTest        = 2
	Failure              = 3
	Timeout              = 4
	NoGoFiles            = 5
	NoConfigFileDetected = 6
	ErrorWasLogged       = 7
)

type ExitError struct {
	Message string
	Code    int
}

func (e ExitError) Error() string {
	return e.Message
}

var (
	ErrNoGoFiles = &ExitError{
		Message: "no go files to analyze",
		Code:    NoGoFiles,
	}
	ErrFailure = &ExitError{
		Message: "failed to analyze",
		Code:    Failure,
	}
)
