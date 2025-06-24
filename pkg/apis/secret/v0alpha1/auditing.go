package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AuditLogConfig struct {
	metav1.TypeMeta `json:",inline"`

	// +optional
	metav1.ObjectMeta `json:"metadata"`

	Spec AuditLogConfigSpec `json:"spec"`
}

type AuditLogConfigSpec struct {
	// Logs to standard output.
	// +optional
	StdoutLogger *StdoutLogger `json:"stdout,omitempty"`

	// Logs to a file.
	// +optional
	FileLogger *FileLogger `json:"file,omitempty"`

	// Logs to Loki.
	// +optional
	LokiLogger *LokiLogger `json:"loki,omitempty"`
}

type StdoutLogger struct {
	// Enable enables or disables the stdout logger.
	Enable bool `json:"enable"`
}

type FileLogger struct {
	// Enable enables or disables the file logger.
	Enable bool `json:"enable"`

	// Path to logs folder
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=1024
	Path string `json:"path"`

	// MaxFileSizeMB is the maximum size in MB of the audit log file before it gets rotated.
	// Defaults to 256MB.
	// +k8s:validation:minimum=256
	// +k8s:validation:maximum=8192
	MaxFileSizeMB int32 `json:"max_file_size_mb"`

	// MaxFiles is the maximum number of old audit log files to retain.
	// Defaults to 5.
	// +k8s:validation:minimum=1
	// +k8s:validation:maximum=1024
	MaxFiles int32 `json:"max_files"`
}

// LokiLoggerProtocol defines the transport protocol used to communicate with Loki.
// +enum
type LokiLoggerProtocol string

const (
	// LokiLoggerProtocolHTTP is the HTTP transport protocol for Loki.
	LokiLoggerProtocolHTTP LokiLoggerProtocol = "http"

	// LokiLoggerProtocolGRPC is the gRPC transport protocol for Loki.
	LokiLoggerProtocolGRPC LokiLoggerProtocol = "grpc"
)

type LokiLogger struct {
	// Enable enables or disables the Loki logger.
	Enable bool `json:"enable"`

	// Set the address for writing logs to Loki.
	URL LokiLoggerAddress `json:"url"`

	// Set the communication protocol to use with Loki. Supported values are "http" and "grpc".
	Protocol LokiLoggerProtocol `json:"protocol"`

	// Establishes a secure connection to Loki.
	TLS bool `json:"tls"`
}

// LokiLoggerAddress is used to specify the address of a Loki instance.
// It can either be a direct URL or a reference to a secure value that contains the URL
// +union
type LokiLoggerAddress struct {
	// This is the address of the Loki instance to which logs will be sent.
	// It should not contain the protocol, i.e. "localhost:9095" instead of "http://localhost:9095".
	// Only available on write path, since this can contain sensitive information.
	// +optional
	// +k8s:validation:minLength=1
	Value ExposedSecureValue `json:"value,omitempty"`

	// SecureValueName is the name of an existing secure value that contains the Loki URL address with credentials.
	// +optional
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	SecureValueName string `json:"secureValueName,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AuditLogConfigList struct {
	metav1.TypeMeta `json:",inline"`

	// +optional
	metav1.ListMeta `json:"metadata"`

	// Slice containing all audit log configs.
	Items []AuditLogConfig `json:"items"`
}
