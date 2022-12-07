package recipes

type StepStatus int8

const (
	Completed StepStatus = iota
	NotCompleted
	Error
)

func (s StepStatus) String() string {
	switch s {
	case Completed:
		return "completed"
	case NotCompleted:
		return "notCompleted"
	case Error:
		return "error"
	}
	return "unknown"
}
