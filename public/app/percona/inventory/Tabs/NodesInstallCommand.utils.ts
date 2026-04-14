export type QuickInstallTech = 'mysql' | 'postgresql' | 'mongodb';

/**
 * Minimal install command: install pmm-client, register, add selected DB with defaults.
 * DB credentials are prompted on the node by install-pmm-client.sh when not passed via env.
 * Replace <TOKEN> with a Grafana service account token (service_token user).
 */
export function buildQuickInstallCommand(tech: QuickInstallTech): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port || (protocol === 'https:' ? '443' : '80');
  const origin = `${protocol}//${window.location.host}`;
  const scriptUrl = `${origin}/pmm-static/install-pmm-client.sh`;
  const serverUrl = `https://service_token:<TOKEN>@${host}:${port}`;

  return [
    `curl -fsSL '${scriptUrl}' | sudo env \\`,
    `  PMM_SERVER_URL='${serverUrl}' \\`,
    `  TECH='${tech}' \\`,
    `  bash`,
  ].join('\n');
}
