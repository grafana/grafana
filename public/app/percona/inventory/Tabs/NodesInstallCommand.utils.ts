export type QuickInstallTech = 'mysql' | 'postgresql' | 'mongodb';

/**
 * Minimal install command: install pmm-client, register, add selected DB with defaults.
 * DB credentials are prompted on the node by install-pmm-client.sh when not passed via env.
 * When `token` is omitted, PMM_SERVER_URL uses the literal placeholder `<TOKEN>` (paste a Grafana service account token).
 */
export function buildQuickInstallCommand(tech: QuickInstallTech, token?: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port || (protocol === 'https:' ? '443' : '80');
  const origin = `${protocol}//${window.location.host}`;
  const scriptUrl = `${origin}/pmm-static/install-pmm-client.sh`;
  const tokenForUrl = token ? encodeURIComponent(token) : '<TOKEN>';
  const serverUrl = `https://service_token:${tokenForUrl}@${host}:${port}`;

  return [
    `curl -fsSL '${scriptUrl}' | sudo env \\`,
    `  PMM_SERVER_URL='${serverUrl}' \\`,
    `  TECH='${tech}' \\`,
    `  bash`,
  ].join('\n');
}
