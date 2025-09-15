package setting

import (
	"crypto/tls"
	"fmt"
	"io/fs"
	"os"
	"time"

	"github.com/spf13/pflag"

	"gopkg.in/ini.v1"
)

type GRPCServerSettings struct {
	Enabled        bool
	Network        string
	Address        string      // with flags, call Process to fill this field defaults
	TLSConfig      *tls.Config // with flags, call Process to fill this field
	EnableLogging  bool        // log request and response of each unary gRPC call
	MaxRecvMsgSize int
	MaxSendMsgSize int

	MaxConnectionAge      time.Duration
	MaxConnectionAgeGrace time.Duration
	KeepaliveTime         time.Duration
	KeepaliveTimeout      time.Duration
	KeepaliveMinTime      time.Duration
	MaxConnectionIdle     time.Duration
	// Internal fields
	useTLS   bool
	certFile string
	keyFile  string
}

func gRPCServerSettingsError(msg string, args ...interface{}) error {
	return fmt.Errorf("grpc_server: "+msg, args...)
}

func (c *GRPCServerSettings) Process() error {
	err := c.processTLSConfig()
	if err != nil {
		return err
	}

	return c.processAddress()
}

func (c *GRPCServerSettings) processTLSConfig() error {
	if !c.useTLS {
		return nil
	}
	serverCert, err := tls.LoadX509KeyPair(c.certFile, c.keyFile)
	if err != nil {
		return gRPCServerSettingsError("error loading X509 key pair: %w", err)
	}
	c.TLSConfig = &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientAuth:   tls.NoClientCert,
	}
	return nil
}

func (c *GRPCServerSettings) processAddress() error {
	switch c.Network {
	case "unix":
		if c.Address != "" {
			// Explicitly provided path for unix domain socket.
			if stat, err := os.Stat(c.Address); os.IsNotExist(err) {
				// File does not exist - nice, nothing to do.
			} else if err != nil {
				return gRPCServerSettingsError("error getting stat for a file: %s", c.Address)
			} else {
				if stat.Mode()&fs.ModeSocket == 0 {
					return gRPCServerSettingsError("file %s already exists and is not a unix domain socket", c.Address)
				}
				// Unix domain socket file, should be safe to remove.
				err := os.Remove(c.Address)
				if err != nil {
					return gRPCServerSettingsError("can't remove unix socket file: %s", c.Address)
				}
			}
		} else {
			// Use temporary file path for a unix domain socket.
			tf, err := os.CreateTemp("", "gf_grpc_server_api")
			if err != nil {
				return gRPCServerSettingsError("error creating tmp file: %v", err)
			}
			unixPath := tf.Name()
			if err := tf.Close(); err != nil {
				return gRPCServerSettingsError("error closing tmp file: %v", err)
			}
			if err := os.Remove(unixPath); err != nil {
				return gRPCServerSettingsError("error removing tmp file: %v", err)
			}
			c.Address = unixPath
		}
		return nil
	case "tcp":
		if c.Address == "" {
			c.Address = "127.0.0.1:10000"
		}
		return nil
	default:
		return gRPCServerSettingsError("unsupported network %s", c.Network)
	}
}

func readGRPCServerSettings(cfg *Cfg, iniFile *ini.File) error {
	server := iniFile.Section("grpc_server")

	// This setting can be used to replace the `FlagGrpcServer` feature flag
	cfg.GRPCServer.Enabled = server.Key("enabled").MustBool(false)

	cfg.GRPCServer.useTLS = server.Key("use_tls").MustBool(false)
	cfg.GRPCServer.certFile = server.Key("cert_file").String()
	cfg.GRPCServer.keyFile = server.Key("cert_key").String()

	if err := cfg.GRPCServer.processTLSConfig(); err != nil {
		return err
	}

	cfg.GRPCServer.Network = valueAsString(server, "network", "tcp")
	cfg.GRPCServer.Address = valueAsString(server, "address", "")
	cfg.GRPCServer.EnableLogging = server.Key("enable_logging").MustBool(false)
	cfg.GRPCServer.MaxRecvMsgSize = server.Key("max_recv_msg_size").MustInt(0)
	cfg.GRPCServer.MaxSendMsgSize = server.Key("max_send_msg_size").MustInt(0)

	// Read connection management options from INI file
	cfg.GRPCServer.MaxConnectionAge = server.Key("max_connection_age").MustDuration(0)
	cfg.GRPCServer.MaxConnectionAgeGrace = server.Key("max_connection_age_grace").MustDuration(0)
	cfg.GRPCServer.MaxConnectionIdle = server.Key("max_connection_idle").MustDuration(0)
	cfg.GRPCServer.KeepaliveTime = server.Key("keepalive_time").MustDuration(0)
	cfg.GRPCServer.KeepaliveTimeout = server.Key("keepalive_timeout").MustDuration(0)
	cfg.GRPCServer.KeepaliveMinTime = server.Key("keepalive_min_time").MustDuration(0)

	return cfg.GRPCServer.processAddress()
}

func (c *GRPCServerSettings) AddFlags(fs *pflag.FlagSet) {
	fs.BoolVar(&c.Enabled, "grpc-server-enabled", false, "Enable gRPC server")
	fs.StringVar(&c.Network, "grpc-server-network", "tcp", "Network type for the gRPC server (tcp, unix)")
	fs.StringVar(&c.Address, "grpc-server-address", "", "Address for the gRPC server")
	fs.BoolVar(&c.EnableLogging, "grpc-server-enable-logging", false, "Enable logging of gRPC requests and responses")
	fs.IntVar(&c.MaxRecvMsgSize, "grpc-server-max-recv-msg-size", 0, "Maximum size of a gRPC request message in bytes")
	fs.IntVar(&c.MaxSendMsgSize, "grpc-server-max-send-msg-size", 0, "Maximum size of a gRPC response message in bytes")

	// Internal flags, we need to call ProcessTLSConfig
	fs.BoolVar(&c.useTLS, "grpc-server-use-tls", false, "Enable TLS for the gRPC server")
	fs.StringVar(&c.certFile, "grpc-server-cert-file", "", "Path to the certificate file for the gRPC server")
	fs.StringVar(&c.keyFile, "grpc-server-key-file", "", "Path to the certificate key file for the gRPC server")

	// Connection management options
	fs.DurationVar(&c.MaxConnectionAge, "grpc-server-max-connection-age", 0, "Maximum amount of time a connection may exist before it will be closed (e.g. 30s)")
	fs.DurationVar(&c.MaxConnectionAgeGrace, "grpc-server-max-connection-age-grace", 0, "Additional time to allow for pending RPCs to complete before forcibly closing connections (e.g. 5s)")
	fs.DurationVar(&c.MaxConnectionIdle, "grpc-server-max-connection-idle", 0, "Maximum amount of idle time before a connection is closed (e.g. 15s)")
	fs.DurationVar(&c.KeepaliveTime, "grpc-server-keepalive-time", 0, "Frequency of server-to-client pings to check if a connection is still active (e.g. 10s)")
	fs.DurationVar(&c.KeepaliveTimeout, "grpc-server-keepalive-timeout", 0, "Amount of time the server waits for a response to keepalive pings before closing the connection (e.g. 3s)")
	fs.DurationVar(&c.KeepaliveMinTime, "grpc-server-keepalive-min-time", 0, "Minimum amount of time a client should wait before sending a keepalive ping (e.g. 5s)")
}
