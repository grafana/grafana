package frontendlogging

// TransformException will attempt to resolved all monified source locations in the stacktrace with original source locations
func TransformException(ex *Exception, store *SourceMapStore) *Exception {
	if ex.Stacktrace == nil {
		return ex
	}
	frames := []Frame{}

	for _, frame := range ex.Stacktrace.Frames {
		frame := frame
		mappedFrame, err := store.resolveSourceLocation(frame)
		if err != nil {
			frames = append(frames, frame)
		} else if mappedFrame != nil {
			frames = append(frames, *mappedFrame)
		} else {
			frames = append(frames, frame)
		}
	}

	return &Exception{
		Type:       ex.Type,
		Value:      ex.Value,
		Stacktrace: &Stacktrace{Frames: frames},
		Timestamp:  ex.Timestamp,
	}
}
