package setting

import (
	"crypto/tls"
	"fmt"
	"io/fs"
	"os"

	"gopkg.in/ini.v1"
)

type GRPCServerSettings struct {
	Network        string
	Address        string
	TLSConfig      *tls.Config
	EnableLogging  bool // log request and response of each unary gRPC call
	MaxRecvMsgSize int
	MaxSendMsgSize int
}

func readGRPCServerSettings(cfg *Cfg, iniFile *ini.File) error {
	server := iniFile.Section("grpc_server")
	errPrefix := "grpc_server:"
	useTLS := server.Key("use_tls").MustBool(false)
	certFile := server.Key("cert_file").String()
	keyFile := server.Key("cert_key").String()
	if useTLS {
		serverCert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return fmt.Errorf("%s error loading X509 key pair: %w", errPrefix, err)
		}
		cfg.GRPCServer.TLSConfig = &tls.Config{
			Certificates: []tls.Certificate{serverCert},
			ClientAuth:   tls.NoClientCert,
		}
	}

	cfg.GRPCServer.Network = valueAsString(server, "network", "tcp")
	cfg.GRPCServer.Address = valueAsString(server, "address", "")
	cfg.GRPCServer.EnableLogging = server.Key("enable_logging").MustBool(false)
	cfg.GRPCServer.MaxRecvMsgSize = server.Key("max_recv_msg_size").MustInt(0)
	cfg.GRPCServer.MaxSendMsgSize = server.Key("max_send_msg_size").MustInt(0)
	switch cfg.GRPCServer.Network {
	case "unix":
		if cfg.GRPCServer.Address != "" {
			// Explicitly provided path for unix domain socket.
			if stat, err := os.Stat(cfg.GRPCServer.Address); os.IsNotExist(err) {
				// File does not exist - nice, nothing to do.
			} else if err != nil {
				return fmt.Errorf("%s error getting stat for a file: %s", errPrefix, cfg.GRPCServer.Address)
			} else {
				if stat.Mode()&fs.ModeSocket == 0 {
					return fmt.Errorf("%s file %s already exists and is not a unix domain socket", errPrefix, cfg.GRPCServer.Address)
				}
				// Unix domain socket file, should be safe to remove.
				err := os.Remove(cfg.GRPCServer.Address)
				if err != nil {
					return fmt.Errorf("%s can't remove unix socket file: %s", errPrefix, cfg.GRPCServer.Address)
				}
			}
		} else {
			// Use temporary file path for a unix domain socket.
			tf, err := os.CreateTemp("", "gf_grpc_server_api")
			if err != nil {
				return fmt.Errorf("%s error creating tmp file: %v", errPrefix, err)
			}
			unixPath := tf.Name()
			if err := tf.Close(); err != nil {
				return fmt.Errorf("%s error closing tmp file: %v", errPrefix, err)
			}
			if err := os.Remove(unixPath); err != nil {
				return fmt.Errorf("%s error removing tmp file: %v", errPrefix, err)
			}
			cfg.GRPCServer.Address = unixPath
		}
	case "tcp":
		if cfg.GRPCServer.Address == "" {
			cfg.GRPCServer.Address = "127.0.0.1:10000"
		}
	default:
		return fmt.Errorf("%s unsupported network %s", errPrefix, cfg.GRPCServer.Network)
	}
	return nil
}
