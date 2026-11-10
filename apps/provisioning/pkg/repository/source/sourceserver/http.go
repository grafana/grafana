package sourceserver

import (
	"context"
	"io"
	"net/http"
	"net/textproto"
	"strconv"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

const (
	// ifNoneMatchKey is how the gateway hands If-None-Match to the gRPC server.
	ifNoneMatchKey = "grpcgateway-if-none-match"
	// statusKey lets a server override the HTTP status of a successful response (304).
	statusKey = "x-http-code"
)

// httpStatus maps an error code to the HTTP status the contract specifies.
var httpStatus = map[string]int{
	sourcev1.CodeBadRequest:         http.StatusBadRequest,
	sourcev1.CodeUnauthorized:       http.StatusUnauthorized,
	sourcev1.CodeForbidden:          http.StatusForbidden,
	sourcev1.CodeSourceNotFound:     http.StatusNotFound,
	sourcev1.CodeFileNotFound:       http.StatusNotFound,
	sourcev1.CodeRevisionNotFound:   http.StatusNotFound,
	sourcev1.CodeRevisionGone:       http.StatusGone,
	sourcev1.CodeAlreadyExists:      http.StatusConflict,
	sourcev1.CodePreconditionFailed: http.StatusPreconditionFailed,
	sourcev1.CodeRateLimited:        http.StatusTooManyRequests,
	sourcev1.CodeNotSupported:       http.StatusNotImplemented,
	sourcev1.CodeUnavailable:        http.StatusServiceUnavailable,
}

// NewHandler is the REST binding of any SourceServiceServer: the paths come from the
// proto annotations, and this adds what they cannot express (error body, ETag, 304).
// Authentication is the caller's concern.
//
// A server returns errors built with fail, and sets etag, cache-control and x-http-code
// with grpc.SetHeader to control the response headers and status.
func NewHandler(srv sourcev1.SourceServiceServer) http.Handler {
	jsonMarshaler := &runtime.HTTPBodyMarshaler{
		Marshaler: &runtime.JSONPb{
			// Zero values stay on the wire ("complete": false); unset messages stay off.
			MarshalOptions:   protojson.MarshalOptions{EmitDefaultValues: true},
			UnmarshalOptions: protojson.UnmarshalOptions{DiscardUnknown: true},
		},
	}

	options := make([]runtime.ServeMuxOption, 0, 4+len(rawContentTypes))
	options = append(options,
		runtime.WithMarshalerOption(runtime.MIMEWildcard, jsonMarshaler),
		runtime.WithErrorHandler(func(_ context.Context, _ *runtime.ServeMux, _ runtime.Marshaler, w http.ResponseWriter, _ *http.Request, err error) {
			writeError(w, err)
		}),
		runtime.WithOutgoingHeaderMatcher(func(key string) (string, bool) {
			switch key {
			case "etag", "cache-control":
				return textproto.CanonicalMIMEHeaderKey(key), true
			}
			return "", false
		}),
		runtime.WithForwardResponseOption(func(ctx context.Context, w http.ResponseWriter, _ proto.Message) error {
			if md, ok := runtime.ServerMetadataFromContext(ctx); ok {
				if v := md.HeaderMD.Get(statusKey); len(v) > 0 {
					if code, err := strconv.Atoi(v[0]); err == nil {
						w.WriteHeader(code)
					}
				}
			}
			return nil
		}),
	)
	// A file is uploaded as it is; every other content type is JSON.
	for _, contentType := range rawContentTypes {
		options = append(options, runtime.WithMarshalerOption(contentType, rawBodyMarshaler{jsonMarshaler}))
	}
	mux := runtime.NewServeMux(options...)

	// Registering against the server directly keeps the hop in process.
	if err := sourcev1.RegisterSourceServiceHandlerServer(context.Background(), mux, srv); err != nil {
		panic(err) // only fails on a malformed route table, which is generated
	}
	return http.MaxBytesHandler(mux, maxFileBytes+maxRequestOverhead)
}

// maxRequestOverhead leaves room around a file for the rest of a request.
const maxRequestOverhead = 64 << 10

// rawContentTypes are the content types a file may be uploaded with.
var rawContentTypes = []string{"application/octet-stream", "application/yaml", "application/x-yaml", "text/yaml", "text/plain"}

// rawBodyMarshaler reads an uploaded file into an HttpBody without parsing it, and leaves
// the rest, including the JSON responses, to the wrapped marshaler.
type rawBodyMarshaler struct {
	runtime.Marshaler
}

func (m rawBodyMarshaler) NewDecoder(r io.Reader) runtime.Decoder {
	return rawBodyDecoder{r: r, fallback: m.Marshaler.NewDecoder(r)}
}

type rawBodyDecoder struct {
	r        io.Reader
	fallback runtime.Decoder
}

func (d rawBodyDecoder) Decode(v any) error {
	field, ok := v.(**httpbody.HttpBody)
	if !ok {
		return d.fallback.Decode(v)
	}

	data, err := io.ReadAll(d.r)
	if err != nil {
		return err
	}
	if len(data) == 0 {
		return io.EOF // an empty file; the generated handler treats it as no body
	}
	*field = &httpbody.HttpBody{Data: data}
	return nil
}

// fail builds a status error carrying the contract's error code.
func fail(code codes.Code, reason, message string) error {
	st, err := status.New(code, message).WithDetails(&errdetails.ErrorInfo{Reason: reason})
	if err != nil {
		return status.Error(code, message)
	}
	return st.Err()
}

// writeError renders any error as the contract's error body.
func writeError(w http.ResponseWriter, err error) {
	st := status.Convert(err)

	reason := ""
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			reason = info.GetReason()
		}
	}
	if _, known := httpStatus[reason]; !known {
		reason = reasonFor(st.Code())
	}

	code := httpStatus[reason]
	body, _ := protojson.MarshalOptions{EmitDefaultValues: true}.Marshal(&sourcev1.Error{
		Code:      reason,
		Message:   st.Message(),
		Retryable: code >= http.StatusInternalServerError || code == http.StatusTooManyRequests,
	})
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(body)
}

// reasonFor covers errors raised outside the server, such as a malformed query.
func reasonFor(c codes.Code) string {
	switch c {
	case codes.InvalidArgument, codes.OutOfRange:
		return sourcev1.CodeBadRequest
	case codes.Unauthenticated:
		return sourcev1.CodeUnauthorized
	case codes.PermissionDenied:
		return sourcev1.CodeForbidden
	case codes.NotFound:
		return sourcev1.CodeFileNotFound
	case codes.AlreadyExists:
		return sourcev1.CodeAlreadyExists
	case codes.FailedPrecondition:
		return sourcev1.CodePreconditionFailed
	case codes.ResourceExhausted:
		return sourcev1.CodeRateLimited
	case codes.Unimplemented:
		return sourcev1.CodeNotSupported
	default:
		return sourcev1.CodeUnavailable
	}
}
