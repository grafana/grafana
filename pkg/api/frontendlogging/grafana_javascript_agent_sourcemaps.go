package frontendlogging

import "context"

// TransformException will attempt to resolve all modified source locations in the stacktrace with original source locations
func TransformException(ctx context.Context, ex *Exception, store *SourceMapStore) *Exception {
	if ex.Stacktrace == nil {
		return ex
	}
	frames := []Frame{}

	for _, frame := range ex.Stacktrace.Frames {
		frame := frame
		mappedFrame, err := store.resolveSourceLocation(ctx, frame)
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
