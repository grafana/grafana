import { type GrafanaTheme2 } from '@grafana/data';

const SLACK_ACCENT = '#4A154B';

export function getIntegrationAccentColor(integrationType: string | undefined, theme: GrafanaTheme2): string {
  switch (integrationType) {
    case 'slack':
      return SLACK_ACCENT;
    case 'email':
      return theme.colors.secondary.main;
    case 'oncall':
      return theme.colors.info.main;
    default:
      return theme.colors.primary.border;
  }
}

export function getIntegrationBadgeLabel(integrationType?: string, integrationLabel?: string): string {
  if (integrationLabel) {
    return integrationLabel;
  }
  if (!integrationType) {
    return 'Notification';
  }
  return integrationType.charAt(0).toUpperCase() + integrationType.slice(1);
}
