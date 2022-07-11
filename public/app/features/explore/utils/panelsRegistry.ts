import { config } from '@grafana/runtime';

export function getPanelForVisType(visType: string) {
  for (const panel of Object.values(config.panels)) {
    if (panel.visualizationType?.includes(visType)) {
      return panel;
    }
  }
}
