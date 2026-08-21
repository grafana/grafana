import { locationUtil, type DataSourceInstanceListItem, type PluginMeta } from '@grafana/data';
import { t } from '@grafana/i18n';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, isPluginEnabled, probePlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { constructDataSourceExploreUrl } from 'app/features/datasources/utils';

import { PROBE_TIMEOUT_MS, withTimeout } from './probeUtils';
import { type SolutionCta } from './types';

async function probeApp(appId: string): Promise<PluginMeta<{}> | null> {
  try {
    // getPluginSettings has no timeout, and some offer checks block Overview grouping.
    const { settings } = await withTimeout(probePlugin(appId), PROBE_TIMEOUT_MS);
    return settings && isPluginEnabled(settings) ? settings : null;
  } catch {
    return null;
  }
}

export async function isDrilldownAvailable(appId: string, appPath: string): Promise<boolean> {
  const settings = await probeApp(appId);
  if (!settings) {
    return false;
  }

  // Some apps put their app-wide permission on the default page while routing CTAs to a deeper path.
  const defaultPage = settings.includes?.find((include) => include.defaultNav && include.path)?.path;
  return (!defaultPage || canAccessPluginPage(settings, defaultPage)) && canAccessPluginPage(settings, appPath);
}

export async function accessibleAppPage(appId: string, path: string): Promise<string | null> {
  const bridgePath = createBridgeURL(appId, path);
  return (await isDrilldownAvailable(appId, bridgePath)) ? bridgePath : null;
}

export async function drilldownActiveCta(
  ds: DataSourceInstanceListItem,
  appId: string,
  appName: string,
  appPath: string
): Promise<SolutionCta<'open_solution'>> {
  return (await isDrilldownAvailable(appId, appPath))
    ? { label: openAppLabel(appName), href: locationUtil.assureBaseUrl(appPath), action: 'open_solution' }
    : { label: openExploreLabel(), href: constructDataSourceExploreUrl({ name: ds.name }), action: 'open_solution' };
}

// Product names are not translated.
export function openAppLabel(appName: string): string {
  return t('home.solutions.cta.open-app', 'Open {{appName}}', { appName });
}

export function openExploreLabel(): string {
  return t('home.solutions.cta.open-explore', 'Open in Explore');
}
