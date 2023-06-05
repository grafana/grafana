package frontendlogging

// ResolveSourceLocation resolves minified source location to original source location
func ResolveSourceLocation(store *SourceMapStore, frame *Frame) (*Frame, error) {
	smap, err := store.getSourceMap(frame.Filename)
	if err != nil {
		return nil, err
	}
	if smap == nil {
		return nil, nil
	}

	file, function, line, col, ok := smap.consumer.Source(frame.Lineno, frame.Colno)
	if !ok {
		return nil, nil
	}

	// unfortunately in many cases go-sourcemap fails to determine the original function name.
	// not a big issue as long as file, line and column are correct
	if len(function) == 0 {
		function = "?"
	}
	return &Frame{
		Filename: file,
		Lineno:   line,
		Colno:    col,
		Function: function,
	}, nil
}

// TransformException will attempt to resolved all monified source locations in the stacktrace with original source locations
func TransformException(ex *Exception, store *SourceMapStore) *Exception {
	if ex.Stacktrace == nil {
		return ex
	}
	frames := []Frame{}

	for _, frame := range ex.Stacktrace.Frames {
		frame := frame
		mappedFrame, err := ResolveSourceLocation(store, &frame)
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
