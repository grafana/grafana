package objectstorage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/tracing"

	"go.opentelemetry.io/otel/attribute"
)

type S3 struct {
	httpClient *http.Client
	tracer     tracing.Tracer
}

func NewS3(httpClient *http.Client, tracer tracing.Tracer) *S3 {
	return &S3{httpClient: httpClient, tracer: tracer}
}

func (s3 *S3) PresignedURLUpload(ctx context.Context, presignedURL, key string, reader io.Reader) (err error) {
	ctx, span := s3.tracer.Start(ctx, "objectstorage.S3.PresignedURLUpload")
	span.SetAttributes(attribute.String("key", key))
	defer span.End()

	url, err := url.Parse(presignedURL)
	if err != nil {
		return fmt.Errorf("parsing presigned url")
	}

	buffer := bytes.NewBuffer([]byte{})
	writer := multipart.NewWriter(buffer)
	defer func() {
		if closeErr := writer.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing multipart writer: %w", closeErr))
		}
	}()

	for k := range url.Query() {
		formField, err := writer.CreateFormField(k)
		if err != nil {
			return fmt.Errorf("creating %s form field: %w", k, err)
		}

		v := url.Query().Get(k)
		if _, err := formField.Write([]byte(v)); err != nil {
			return fmt.Errorf("writing value for form field: field=%s value=%s", k, v)
		}
	}

	formField, err := writer.CreateFormField("key")
	if err != nil {
		return fmt.Errorf(": %w", err)
	}
	_, err = formField.Write([]byte(key))
	if err != nil {
		return fmt.Errorf("writing key form field value: %w", err)
	}

	formField, err = writer.CreateFormFile("file", "file")
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	_, err = io.Copy(formField, reader)
	if err != nil {
		return fmt.Errorf(": %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("closing multipart writer: %w", err)
	}

	endpoint := fmt.Sprintf("%s://%s%s", url.Scheme, url.Host, url.Path)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, buffer)
	if err != nil {
		return fmt.Errorf("creating http request: %w", err)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())

	response, err := s3.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("sending http request: %w", err)
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing response body: %w", closeErr))
		}
	}()

	if response.StatusCode >= 400 {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("unexpected response: status=%d body=%s", response.StatusCode, string(body))
	}

	return nil
}
