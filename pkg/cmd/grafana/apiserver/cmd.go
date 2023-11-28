package apiserver

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/snapshots"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/spf13/cobra"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/component-base/cli"
)

func newCommandStartExampleAPIServer(o *ExampleServerOptions, stopCh <-chan struct{}, snapshotsBuilder *snapshots.SnapshotsAPIBuilder, playlistBuilder *playlist.PlaylistAPIBuilder) *cobra.Command {
	// While this exists as an experimental feature, we require adding the scarry looking command line
	devAcknowledgementFlag := "grafana-enable-experimental-apiserver"
	devAcknowledgementNotice := "The apiserver command is in heavy development.  The entire setup is subject to change without notice"

	cmd := &cobra.Command{
		Use:   "apiserver [api group(s)]",
		Short: "Run the grafana apiserver",
		Long: "Run a standalone kubernetes based apiserver that can be aggregated by a root apiserver. " +
			devAcknowledgementNotice,
		Example: fmt.Sprintf("grafana apiserver example.grafana.app --%s", devAcknowledgementFlag),
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			ok, err := cmd.Flags().GetBool(devAcknowledgementFlag)
			if !ok || err != nil {
				fmt.Printf("requires running with the flag: --%s\n\n%s\n\n",
					devAcknowledgementFlag, devAcknowledgementNotice)
				os.Exit(1)
			}
		},
		RunE: func(c *cobra.Command, args []string) error {
			// Parse builders for each group in the args
			builders, err := ParseAPIGroupArgs(args[1:], snapshotsBuilder, playlistBuilder)
			if err != nil {
				return err
			}

			if err := o.LoadAPIGroupBuilders(builders); err != nil {
				return err
			}

			// Finish the config (applies all defaults)
			if err := o.Complete(); err != nil {
				return err
			}

			config, err := o.Config()
			if err != nil {
				return err
			}

			if err := o.RunExampleServer(config, stopCh); err != nil {
				return err
			}
			return nil
		},
	}

	// Register grafana flags
	cmd.PersistentFlags().Bool(devAcknowledgementFlag, false, devAcknowledgementNotice)

	// Register standard k8s flags with the command line
	o.RecommendedOptions = options.NewRecommendedOptions(
		defaultEtcdPathPrefix,
		Codecs.LegacyCodec(), // the codec is passed to etcd and not used
	)
	o.RecommendedOptions.AddFlags(cmd.Flags())

	return cmd
}

func ParseAPIGroupArgs(args []string, snapshotsBuilder *snapshots.SnapshotsAPIBuilder, playlistBuilder *playlist.PlaylistAPIBuilder) ([]grafanaAPIServer.APIGroupBuilder, error) {
	builders := make([]grafanaAPIServer.APIGroupBuilder, 0)
	for _, g := range args {
		switch g {
		// No dependencies for testing
		case "example.grafana.app":
			builders = append(builders, &example.TestingAPIBuilder{})
		case "playlist.grafana.app":
			builders = append(builders, playlistBuilder)
		case "snapshots.grafana.app":
			builders = append(builders, snapshotsBuilder)
		}
	}

	if len(builders) < 1 {
		return nil, fmt.Errorf("expected group name(s) in the command line arguments")
	}

	return builders, nil
}

func RunCLI() int {
	stopCh := genericapiserver.SetupSignalHandler()

	options := newExampleServerOptions(os.Stdout, os.Stderr)

	cfg, _ := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   "conf/custom.ini",
		HomePath: "./",
	})
	sb, _ := initializeSnapshotsAPIBuilder(context.Background(), cfg)
	pb, _ := initializePlaylistsAPIBuilder(context.Background(), cfg)

	cmd := newCommandStartExampleAPIServer(options, stopCh, sb, pb)

	return cli.Run(cmd)
}
