package frontendlogging

// TransformException will attempt to resolved all monified source locations in the stacktrace with original source locations
func TransformException(ex *Exception) *Exception {
	if ex.Stacktrace == nil {
		return ex
	}
	frames := []Frame{}

	frames = append(frames, ex.Stacktrace.Frames...)

	return &Exception{
		Type:       ex.Type,
		Value:      ex.Value,
		Stacktrace: &Stacktrace{Frames: frames},
		Timestamp:  ex.Timestamp,
	}
}
