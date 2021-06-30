package grafanats

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"
)

var (
	logger = log.New("grafanats")
)

func init() {
	registry.RegisterService(&Grafanats{})
}

// Grafanats service,
type Grafanats struct {
	Cfg *setting.Cfg `inject:""`

	conn   *nats.Conn
	client nats.JetStreamContext
	server *server.Server
}

func (g *Grafanats) Client() nats.JetStreamContext {
	return g.client
}

func (g *Grafanats) IsLeader() bool {
	return g.server.JetStreamIsLeader()
}

// GF_SERVER_ID=1 GF_SERVER_HTTP_PORT=3000 GF_NATS_PORT=4222 GF_NATS_CLUSTER_PORT=10000 GF_NATS_CLUSTER_ROUTES='nats-route://localhost:10001,nats-route://localhost:10002' make run
// GF_SERVER_ID=2 GF_SERVER_HTTP_PORT=3001 GF_NATS_PORT=4223 GF_NATS_CLUSTER_PORT=10001 GF_NATS_CLUSTER_ROUTES='nats-route://localhost:10000,nats-route://localhost:10002' make run
// GF_SERVER_ID=3 GF_SERVER_HTTP_PORT=3002 GF_NATS_PORT=4224 GF_NATS_CLUSTER_PORT=10002 GF_NATS_CLUSTER_ROUTES='nats-route://localhost:10000,nats-route://localhost:10001' make run
//
// Possible use cases:
// * Synchronize Grafana server instances (datasource config changes, plugin installation), avoid periodic db checks
// * Asynchronous event passing for external integrations - like dashboard changed (could be much better with transactional outbox)
// * Point MQTT device to Grafana itself instead of MQTT broker, on plugin side push data to panels reading from Grafana MQTT topic
// * Live PUB/SUB without external dependencies (like Redis), question: how to handle schema updates?
// * Communication with remote plugins – just issue a request and wait for a reply.

// Init Grafanats.
func (g *Grafanats) Init() error {
	logger.Info("Grafanats initialization")
	opts, err := server.ProcessConfigFile("conf/nats.conf")
	if err != nil {
		return fmt.Errorf("failed to parse embedded NATS server config")
	}
	opts.Port, err = strconv.Atoi(os.Getenv("GF_NATS_PORT"))
	if err != nil {
		return err
	}
	if os.Getenv("GF_SERVER_ID") != "" {
		opts.StoreDir = "data/grafanats/server-" + os.Getenv("GF_SERVER_ID")
		opts.ServerName = os.Getenv("GF_SERVER_ID")
		opts.Cluster.Port, err = strconv.Atoi(os.Getenv("GF_NATS_CLUSTER_PORT"))
		if err != nil {
			return err
		}
		opts.Routes = server.RoutesFromStr(os.Getenv("GF_NATS_CLUSTER_ROUTES"))
	}

	opts.JetStream = true

	natsServer, err := server.NewServer(opts)
	if err != nil {
		return fmt.Errorf("failed to initialize embedded NATS server")
	}
	natsServer.ConfigureLogger()
	go func() {
		natsServer.Start()
	}()

	g.server = natsServer

	var client *nats.Conn
	numAttempts := 0
	maxAttempts := 30
	for {
		//client, err = nats.Connect("localhost:4222,localhost:4223,localhost:4224")
		client, err = nats.Connect("localhost:" + os.Getenv("GF_NATS_PORT"))
		if err != nil {
			if numAttempts >= maxAttempts {
				return fmt.Errorf("error connecting to cluster: %v", err)
			}
			logger.Error(err.Error())
			numAttempts++
			time.Sleep(time.Second)
			continue
		}
		break
	}
	// Create JetStream Context
	js, err := client.JetStream(nats.PublishAsyncMaxPending(256))
	if err != nil {
		return fmt.Errorf("error creating JetStream context: %v", err)
	}
	g.conn = client
	g.client = js
	logger.Info("event stream client initialized")

	for _, s := range eventStreams {
		err := g.createStream(s)
		if err != nil {
			return err
		}
	}

	for _, s := range eventStreams {
		err := g.subscribeStream(s)
		if err != nil {
			return err
		}
	}

	return nil
}

func (g *Grafanats) createStream(s EventStream) error {
	for i := 0; i < 5; i++ {
		_, err := g.client.AddStream(&nats.StreamConfig{
			Name:     s.Name,
			Subjects: []string{s.Subject},
			Replicas: s.Replicas,
		})
		if err != nil {
			if strings.Contains(err.Error(), "stream name already in use") {
				return nil
			}
			logger.Error("Error creating stream", "error", err.Error())
			time.Sleep(3 * time.Second)
			continue
		}
		return nil
	}
	return fmt.Errorf("error creating stream %s", s.Name)
}

func (g *Grafanats) subscribeStream(s EventStream) error {
	_, err := g.client.Subscribe(s.Subject, func(msg *nats.Msg) {
		fmt.Printf("received message: %s %v\n", string(msg.Data), msg.Reply)
		_ = msg.Ack()
	}, nats.DeliverNew(), nats.Durable("consumer-"+os.Getenv("GF_SERVER_ID")))
	if err != nil {
		return fmt.Errorf("error subscribing: %v", s.Name)
	}
	return nil
}

// Run Grafanats.
func (g *Grafanats) Run(ctx context.Context) error {
	//count := 0
loop:
	for {
		select {
		case <-ctx.Done():
			break loop
		case <-time.After(time.Second):
			//ack, err := g.client.Publish("datasource_changes", []byte(strconv.Itoa(count)))
			//if err != nil {
			//	logger.Error("error publishing to event stream", "error", err.Error())
			//	continue
			//}
			//count++
			//logger.Info("published to a stream", "stream", ack.Stream, "sequence", ack.Sequence)
		}
	}
	_ = g.conn.Close
	return ctx.Err()
}
