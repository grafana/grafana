import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

export interface DifyEmbedConfig {
  embedUrl: string;
  hasEmbedToken: boolean;
  embedBase?: string;
}

const PROXY_BASE = 'http://localhost:3456';

async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${PROXY_BASE}${path}`);
    const data: T = await res.json();
    if (!res.ok) {
      throw new Error((data as { message?: string }).message || `Dify proxy error ${res.status}`);
    }
    return data;
  } catch (proxyErr) {
    try {
      return await getBackendSrv().get(`/api/assistant-dify${path}`);
    } catch {
      throw proxyErr;
    }
  }
}

/** Append theme hints so the embedded Dify UI tracks Grafana light/dark mode when supported. */
export function withEmbedTheme(embedUrl: string, theme: GrafanaTheme2): string {
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('theme', theme.isDark ? 'dark' : 'light');
    return url.toString();
  } catch {
    return embedUrl;
  }
}

export async function fetchDifyEmbedConfig(): Promise<DifyEmbedConfig> {
  return getJson<DifyEmbedConfig>('/embed-config');
}
