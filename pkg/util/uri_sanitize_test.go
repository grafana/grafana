package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_sanitizeURI(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		want        string
		expectError bool
	}{
		{
			name:  "Receiving empty string should return it",
			input: "",
			want:  "",
		},
		{
			name:  "Receiving URL with auth_token should remove it",
			input: "https://grafana.com/?auth_token=secret-token&q=1234",
			want:  "https://grafana.com/?auth_token=hidden&q=1234",
		},
		{
			name:  "Receiving presigned URL from AWS should remove signature",
			input: "https://s3.amazonaws.com/finance-department-bucket/2022/tax-certificate.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3SGQVQG7FGA6KKA6%2F20221104%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20221104T140227Z&X-Amz-Expires=3600&X-Amz-Signature=b22&X-Amz-SignedHeaders=host",
			want:  "https://s3.amazonaws.com/finance-department-bucket/2022/tax-certificate.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3SGQVQG7FGA6KKA6%2F20221104%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20221104T140227Z&X-Amz-Expires=3600&X-Amz-Signature=hidden&X-Amz-SignedHeaders=host",
		},
		{
			name:  "Receiving presigned URL from GCP should remove signature",
			input: "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&X-Goog-Signature=247a&X-Goog-SignedHeaders=host",
			want:  "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&X-Goog-Signature=hidden&X-Goog-SignedHeaders=host",
		},
		{
			name:  "Receiving presigned URL with lower case query params from GCP should remove signature",
			input: "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&x-goog-signature=247a&X-Goog-SignedHeaders=host",
			want:  "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&x-goog-signature=hidden",
		},
		{
			name:  "Receiving presigned URL from Azure should remove signature",
			input: "https://myaccount.queue.core.windows.net/myqueue/messages?se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&sig=jDrr6cna7JPwIaxWfdH0tT5v9dc%3d&sp=p&st=2015-07-01T08%3A49Z&sv=2015-02-21&visibilitytimeout=120",
			want:  "https://myaccount.queue.core.windows.net/myqueue/messages?se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&sig=hidden&sp=p&st=2015-07-01T08%3A49Z&sv=2015-02-21&visibilitytimeout=120",
		},
		{
			name:  "Receiving presigned URL from Azure with upper case query values should remove signature",
			input: "https://myaccount.queue.core.windows.net/myqueue/messages?se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&SIG=jDrr6cna7JPwIaxWfdH0tT5v9dc%3d&sp=p&st=2015-07-01T08%3A49Z&SV=2015-02-21&visibilitytimeout=120",
			want:  "https://myaccount.queue.core.windows.net/myqueue/messages?SIG=hidden&SV=2015-02-21&se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&sp=p&st=2015-07-01T08%3A49Z&visibilitytimeout=120",
		},
		{
			name:  "Receiving valid URL string should return it parsed",
			input: "https://grafana.com/?sig=testing-a-generic-parameter",
			want:  "https://grafana.com/?sig=testing-a-generic-parameter",
		},
		{
			name:        "Receiving invalid URL string should return empty string",
			input:       "this is not a valid URL",
			want:        "",
			expectError: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url, err := SanitizeURI(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equalf(t, tt.want, url, "SanitizeURI(%v)", tt.input)
		})
	}
}
