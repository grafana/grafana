// Package main runs a standalone gRPC server that implements TupleStorageService.
// It is a reference implementation you can run locally to try Grafana's custom tuple storage mode.
//
// Build and run (default: SQLite at ./tuple-storage.db):
//
//	go run ./pkg/cmd/tuple-storage-service
//
// With flags:
//
//	go run ./pkg/cmd/tuple-storage-service -addr 127.0.0.1:50051 -storage sqlite -db ./data/tuples.db
//	go run ./pkg/cmd/tuple-storage-service -storage memory
//	go run ./pkg/cmd/tuple-storage-service -debug
//
// Use -debug to set log level to debug (enables verbose request logging from TupleStorageSQLServer).
//
// Then in conf/custom.ini:
//
//	[zanzana.server]
//	storage_mode = custom
//	tuple_service_addr = 127.0.0.1:50051
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/peer"

	grafanalog "github.com/grafana/grafana/pkg/infra/log"
	tuplepb "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/openfga/openfga/pkg/storage/migrate"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	"github.com/openfga/openfga/pkg/storage/sqlite"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:50051", "gRPC listen address (host:port)")
	storageBackend := flag.String("storage", "sqlite", "Backend: sqlite (default, persistent) or memory (ephemeral)")
	dbPath := flag.String("db", "tuple-storage.db", "SQLite database path (used when -storage=sqlite)")
	debug := flag.Bool("debug", false, "Set log level to debug (enables verbose request logging)")
	flag.Parse()

	if *debug {
		if err := grafanalog.SetupConsoleLogger("debug"); err != nil {
			log.Fatalf("setup debug logging: %v", err)
		}
	}

	ds, err := newDatastore(*storageBackend, *dbPath)
	if err != nil {
		log.Fatalf("datastore: %v", err)
	}
	defer ds.Close()

	srv := store.NewTupleStorageSQLServer(ds, grafanalog.New("tuple-storage-server"))
	grpcServer := grpc.NewServer(
		grpc.Creds(insecure.NewCredentials()),
		grpc.ChainUnaryInterceptor(accessLogUnaryInterceptor()),
		grpc.ChainStreamInterceptor(accessLogStreamInterceptor()),
	)
	tuplepb.RegisterTupleStorageServiceServer(grpcServer, srv)

	lis, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	fmt.Printf("Tuple storage service listening on %s (backend: %s)\n", *addr, *storageBackend)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func newDatastore(backend, dbPath string) (storage.OpenFGADatastore, error) {
	switch backend {
	case "memory":
		return memory.New(), nil
	case "sqlite":
		return newSQLiteDatastore(dbPath)
	default:
		return nil, fmt.Errorf("unsupported storage %q (use sqlite or memory)", backend)
	}
}

func newSQLiteDatastore(path string) (storage.OpenFGADatastore, error) {
	cfg := &sqlcommon.Config{
		Logger:                 logger.NewNoopLogger(),
		MaxTuplesPerWriteField: 100,
		MaxTypesPerModelField:  100,
	}
	if err := migrate.RunMigrations(migrate.MigrationConfig{
		Engine: "sqlite",
		URI:    path,
		Logger: cfg.Logger,
	}); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}
	return sqlite.New(path, cfg)
}

// accessLogUnaryInterceptor logs each unary RPC: method, peer, duration, status.
func accessLogUnaryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()
		peerAddr := peerFromContext(ctx)
		method := methodName(info.FullMethod)

		resp, err := handler(ctx, req)
		dur := time.Since(start)
		status := "ok"
		if err != nil {
			status = "err"
		}
		log.Printf("access %s %s %s %v", method, peerAddr, status, dur.Round(time.Millisecond))
		if err != nil {
			log.Printf("access %s error: %v", method, err)
		}
		return resp, err
	}
}

// accessLogStreamInterceptor logs each streaming RPC when the stream ends: method, peer, duration, status.
func accessLogStreamInterceptor() grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()
		peerAddr := peerFromContext(ss.Context())
		method := methodName(info.FullMethod)

		err := handler(srv, ss)
		dur := time.Since(start)
		status := "ok"
		if err != nil {
			status = "err"
		}
		log.Printf("access %s %s %s %v (stream)", method, peerAddr, status, dur.Round(time.Millisecond))
		if err != nil {
			log.Printf("access %s error: %v", method, err)
		}
		return err
	}
}

func peerFromContext(ctx context.Context) string {
	p, ok := peer.FromContext(ctx)
	if !ok || p == nil || p.Addr == nil {
		return "-"
	}
	return p.Addr.String()
}

func methodName(fullMethod string) string {
	// fullMethod is like "/authz.tuple.v1.TupleStorageService/WriteTuples"
	if i := len(fullMethod) - 1; i >= 0 {
		for i >= 0 && fullMethod[i] != '/' {
			i--
		}
		if i >= 0 {
			return fullMethod[i+1:]
		}
	}
	return fullMethod
}
