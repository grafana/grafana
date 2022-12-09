package recipes

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type RecipesProvider interface {
	GetById(id string) *Recipe
	GetAll() []*Recipe
}

type staticRecipesProvider struct {
	recipes []*Recipe
}

func (s *staticRecipesProvider) GetById(id string) *Recipe {
	for _, recipe := range s.recipes {
		if recipe.Id == id {
			return recipe
		}
	}
	return nil
}

func (s *staticRecipesProvider) GetAll() []*Recipe {
	return s.recipes
}

func ProvideService(i plugins.Installer, cfg *setting.Cfg, ps plugins.Store, datasourceService datasources.DataSourceService, dashboardService dashboards.DashboardService) RecipesProvider {

	recipes := []*Recipe{
		// Linux Server
		{
			Id:               "linux-server",
			Name:             "Linux Server",
			IsInstallStarted: false,
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs related to the linux operating system",
				Description: "The Linux integration uses the agent to collect metrics related to the operating system running on a node, including aspects like CPU usage, load average, memory usage, and disk and networking I/O.\n\nIt also supports logs being scraped by the agent using promtail. \nSupported files are syslog, auth.log, kern.log and journal logs.\n\nAn accompanying dashboard is provided to visualize these metrics and logs.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/linux.png",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Install the Jira Datasource plugin",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				newInstructionStep(
					InstructionStepMeta{
						Name:                                "Install `htop`",
						Description:                         "Install the famous interactive process viewer",
						InstructionText:                     "```sudo apt install htop```",
						InstructionTestURL:                  "",
						InstructionTestExpectedHttpResponse: "",
					},
				),
				newSetupAlertsStep(RecipeStepMeta{
					Name:        "Setup alert rules",
					Description: "Configuring alert rules",
				}, []AlertRule{
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfSpace",
						Summary:   "Filesystem has less than 5% space left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfSpace",
						Summary:   "Filesystem has less than 3% space left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemFilesFillingUp",
						Summary:   "Filesystem is predicted to run out of inodes within the next 24 hours.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemFilesFillingUp",
						Summary:   "Filesystem is predicted to run out of inodes within the next 4 hours.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfFiles",
						Summary:   "Filesystem has less than 5% inodes left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfFiles",
						Summary:   "Filesystem has less than 3% inodes left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeNetworkReceiveErrs",
						Summary:   "Network interface is reporting many receive errors.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeNetworkTransmitErrs",
						Summary:   "Network interface is reporting many transmit errors.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeHighNumberConntrackEntriesUsed",
						Summary:   "Number of conntrack are getting close to the limit.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeTextFileCollectorScrapeError",
						Summary:   "Node Exporter text file collector failed to scrape.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeClockSkewDetected",
						Summary:   "Clock skew detected.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeClockNotSynchronising",
						Summary:   "Clock not synchronising.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeRAIDDegraded",
						Summary:   "RAID Array is degraded.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeRAIDDiskFailure",
						Summary:   "Failed device in RAID array.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFileDescriptorLimit",
						Summary:   "Kernel is predicted to exhaust file descriptors limit soon.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFileDescriptorLimit",
						Summary:   "Kernel is predicted to exhaust file descriptors limit soon.",
					},
				}),
			},
		},

		// Docker
		{
			Id:               "docker",
			Name:             "Docker",
			IsInstallStarted: false,
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs for containers running in docker",
				Description: "Docker is an open platform for developing, shipping, and running applications. Docker enables you to separate your applications from your infrastructure so you can deliver software quickly.\n\nThis integration focuses on showing overall utilization of containers running in Docker, using cAdvisor.\n\nThis integration also supports logs monitoring for Docker containers.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/docker.png",
			},
			Steps: []RecipeStep{
				newInstallAgentStep(RecipeStepMeta{
					Name:        "Install Grafana Agent",
					Description: "Install the Grafana Agent to collect metrics from your server",
				}, []AgentMetrics{
					{
						Name: "container_last_seen",
					},
					{
						Name: "container_memory_usage_bytes",
					},
					{
						Name: "container_fs_inodes_total",
					},
					{
						Name: "container_cpu_usage_seconds_total",
					},
					{
						Name: "machine_memory_bytes",
					},
					{
						Name: "container_fs_usage_bytes",
					},
					{
						Name: "container_network_receive_bytes_total",
					},
					{
						Name: "machine_scrape_error",
					},
					{
						Name: "container_spec_memory_reservation_limit_bytes",
					},
					{
						Name: "container_network_transmit_bytes_total",
					},
					{
						Name: "container_network_tcp_usage_total",
					},
					{
						Name: "container_fs_limit_bytes",
					},
					{
						Name: "container_fs_inodes_free",
					},
				}),
				newSetupDatasourceStep(datasourceService, RecipeStepMeta{
					Name:        "Setting up datasource",
					Description: "something here..",
				}),
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Install the Jira Datasource plugin",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				newInstructionStep(
					InstructionStepMeta{
						Name:                                "Some instruction",
						Description:                         "Some description here...",
						InstructionText:                     "Some markdown here...",
						InstructionTestURL:                  "http://my-service.com/api/health",
						InstructionTestExpectedHttpResponse: "200",
					},
				),
				newSetupAlertsStep(RecipeStepMeta{
					Name:        "Setup alert rules",
					Description: "Configuring alert rules",
				}, []AlertRule{
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfSpace",
						Summary:   "Filesystem has less than 5% space left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfSpace",
						Summary:   "Filesystem has less than 3% space left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemFilesFillingUp",
						Summary:   "Filesystem is predicted to run out of inodes within the next 24 hours.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemFilesFillingUp",
						Summary:   "Filesystem is predicted to run out of inodes within the next 4 hours.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfFiles",
						Summary:   "Filesystem has less than 5% inodes left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFilesystemAlmostOutOfFiles",
						Summary:   "Filesystem has less than 3% inodes left.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeNetworkReceiveErrs",
						Summary:   "Network interface is reporting many receive errors.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeNetworkTransmitErrs",
						Summary:   "Network interface is reporting many transmit errors.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeHighNumberConntrackEntriesUsed",
						Summary:   "Number of conntrack are getting close to the limit.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeTextFileCollectorScrapeError",
						Summary:   "Node Exporter text file collector failed to scrape.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeClockSkewDetected",
						Summary:   "Clock skew detected.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeClockNotSynchronising",
						Summary:   "Clock not synchronising.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeRAIDDegraded",
						Summary:   "RAID Array is degraded.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeRAIDDiskFailure",
						Summary:   "Failed device in RAID array.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFileDescriptorLimit",
						Summary:   "Kernel is predicted to exhaust file descriptors limit soon.",
					},
					{
						Namespace: "integrations-linux-node",
						Group:     "node-exporter",
						Name:      "NodeFileDescriptorLimit",
						Summary:   "Kernel is predicted to exhaust file descriptors limit soon.",
					},
				}),
				newSetupDashboardStep(dashboardService, RecipeStepMeta{
					Name:        "Setup dashboards to view docker metrics",
					Description: "Dashboard to visualize metrics gathered by this recipe",
				},
					&dashboardSettings{
						Screenshots: []RecipeStepScreenshot{
							{
								Name: "Metrics",
								Url:  "https://storage.googleapis.com/grafanalabs-integration-assets/docker/screenshots/docker_overview.png",
							},
						},
					},
				),
				newSetupDashboardStep(dashboardService, RecipeStepMeta{
					Name:        "Setup dashboard to view docker logs",
					Description: "Dashboard to visualize logs gathered by this recipe.",
				},
					&dashboardSettings{
						Screenshots: []RecipeStepScreenshot{
							{
								Name: "Logs",
								Url:  "https://storage.googleapis.com/grafanalabs-integration-assets/docker/screenshots/docker_logs.png",
							},
						},
					},
				),
			},
		},

		// MySQL
		{
			Id:               "mysql",
			Name:             "MySQL",
			IsInstallStarted: false,
			Meta: RecipeMeta{
				Summary:     "Collects metrics and logs from the MySQL server",
				Description: "MySQL is a managed, open source relational database that is widely used. The MySQL Integration enables the Grafana Agent to send metrics and logs to Grafana Cloud and includes useful dashboards, alerts, and recording rules.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/mysql.png",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Install the Jira Datasource plugin",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				newInstructionStep(
					InstructionStepMeta{
						Name:                                "Some instruction",
						Description:                         "Some description here...",
						InstructionText:                     "Some markdown here...",
						InstructionTestURL:                  "http://my-service.com/api/health",
						InstructionTestExpectedHttpResponse: "200",
					},
				),
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "anodot-panel",
						Version: "2.0.1",
					},
				),
			},
		},

		// Mac OS
		{
			Id:               "macos",
			Name:             "MacOS",
			IsInstallStarted: false,
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs related to the macOS operating system",
				Description: "The macOS integration uses the agent to collect metrics related to the operating system, including aspects like CPU usage, load average, memory usage, and disk and networking I/O. It also supports system logs being scraped by the agent using promtail. An accompanying dashboard is provided to visualize these metrics and logs.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/apple.svg",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Install the Jira Datasource plugin",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				newInstructionStep(
					InstructionStepMeta{
						Name:                                "Some instruction",
						Description:                         "Some description here...",
						InstructionText:                     "Some markdown here...",
						InstructionTestURL:                  "http://my-service.com/api/health",
						InstructionTestExpectedHttpResponse: "200",
					},
				),
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				newPluginInstallStep(i, cfg, ps,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, &installPlugin{
						Id:      "anodot-panel",
						Version: "2.0.1",
					},
				),
			},
		},
	}

	return &staticRecipesProvider{
		recipes: recipes,
	}
}
