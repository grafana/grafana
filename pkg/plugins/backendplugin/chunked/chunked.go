package chunked

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type RawChunkReceiver interface {
	OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error
}

func ProcessTypedResponse(ctx context.Context, rsp *backend.QueryDataResponse, w backend.ChunkedDataWriter) (err error) {
	for refID, res := range rsp.Responses {
		for idx, frame := range res.Frames {
			if err = w.WriteFrame(ctx, refID, fmt.Sprintf("%d", idx), frame); err != nil {
				return err
			}
		}
		if res.Error != nil {
			if err = w.WriteError(ctx, refID, res.Status, res.Error); err != nil {
				return err
			}
		}
	}
	return nil
}

func ProcessRawResponse(ctx context.Context, format backend.DataFrameFormat, rsp *pluginv2.QueryDataResponse, w RawChunkReceiver) (err error) {
	for refId, res := range rsp.Responses {
		for idx, frame := range res.Frames {
			// Requesting JSON, but it arrived as arrow
			if format == backend.DataFrameFormat_JSON && frame[0] != '{' {
				f, err := data.UnmarshalArrowFrame(frame)
				if err != nil {
					return err
				}
				frame, err = f.MarshalJSON()
				if err != nil {
					return err
				}
			}

			if err = w.OnChunk(&pluginv2.QueryChunkedDataResponse{
				RefId:   refId,
				FrameId: fmt.Sprintf("%d", idx),
				Frame:   frame,
				Format:  pluginv2.DataFrameFormat(format),
				Status:  res.Status,
			}); err != nil {
				return err
			}
		}
		if res.Error != "" {
			if err = w.OnChunk(&pluginv2.QueryChunkedDataResponse{
				RefId:       refId,
				Error:       res.Error,
				ErrorSource: res.ErrorSource,
				Format:      pluginv2.DataFrameFormat(format),
				Status:      res.Status,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}
