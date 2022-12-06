package recipes

import (
	"github.com/grafana/grafana/pkg/plugins"
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

func ProvideService(i plugins.Installer, cfg *setting.Cfg) RecipesProvider {
	recipes := []*Recipe{
		// Linux Server
		{
			Id:   "linux-server",
			Name: "Linux Server",
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs related to the linux operating system",
				Description: "The Linux integration uses the agent to collect metrics related to the operating system running on a node, including aspects like CPU usage, load average, memory usage, and disk and networking I/O.\n\nIt also supports logs being scraped by the agent using promtail. \nSupported files are syslog, auth.log, kern.log and journal logs.\n\nAn accompanying dashboard is provided to visualize these metrics and logs.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/linux.png",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, recipePluginStep{
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
			},
		},

		// Docker
		{
			Id:   "docker",
			Name: "Docker",
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs for containers running in docker",
				Description: "Docker is an open platform for developing, shipping, and running applications. Docker enables you to separate your applications from your infrastructure so you can deliver software quickly.\n\nThis integration focuses on showing overall utilization of containers running in Docker, using cAdvisor.\n\nThis integration also supports logs monitoring for Docker containers.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/docker.png",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, recipePluginStep{
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
				newSetupDashboardStep(dashboardStepMeta{
					RecipeStepMeta: RecipeStepMeta{
						Name:        "Setup dashboards to view docker metrics",
						Description: "This dashboard will let you visualize the metrics gathered by the Grafana agent running on your server.",
					},
					Screenshots: []RecipeStepScreenshot{
						{
							Name: "Metrics",
							Url:  "https://storage.googleapis.com/grafanalabs-integration-assets/docker/screenshots/docker_overview.png",
						},
					},
				}),
				newSetupDashboardStep(dashboardStepMeta{
					RecipeStepMeta: RecipeStepMeta{
						Name:        "Setup dashboard to view docker logs",
						Description: "This dashboard will let you visualize the logs gathered by the Grafana agent running on your server.",
					},
					Screenshots: []RecipeStepScreenshot{
						{
							Name: "Logs",
							Url:  "https://storage.googleapis.com/grafanalabs-integration-assets/docker/screenshots/docker_logs.png",
						},
					},
				}),
			},
		},

		// MySQL
		{
			Id:   "mysql",
			Name: "MySQL",
			Meta: RecipeMeta{
				Summary:     "Collects metrics and logs from the MySQL server",
				Description: "MySQL is a managed, open source relational database that is widely used. The MySQL Integration enables the Grafana Agent to send metrics and logs to Grafana Cloud and includes useful dashboards, alerts, and recording rules.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/mysql.png",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, recipePluginStep{
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
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "anodot-panel",
						Version: "2.0.1",
					},
				),
			},
		},

		// Mac OS
		{
			Id:   "macos",
			Name: "MacOS",
			Meta: RecipeMeta{
				Summary:     "Collect metrics and logs related to the macOS operating system",
				Description: "The macOS integration uses the agent to collect metrics related to the operating system, including aspects like CPU usage, load average, memory usage, and disk and networking I/O. It also supports system logs being scraped by the agent using promtail. An accompanying dashboard is provided to visualize these metrics and logs.",
				Logo:        "https://storage.googleapis.com/grafanalabs-integration-logos/apple.svg",
			},
			Steps: []RecipeStep{
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, recipePluginStep{
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
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				newPluginInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, recipePluginStep{
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
