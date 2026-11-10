export type AppId = 'metrics' | 'logs' | 'traces' | 'profiles';

// The Drilldown nav children are the installed apps; match them by title so links follow each app's real route.
export function getAppUrls(children: Array<{ text: string; url?: string }>): Partial<Record<AppId, string>> {
  const urls: Partial<Record<AppId, string>> = {};
  for (const child of children) {
    const key = (['metrics', 'logs', 'traces', 'profiles'] as const).find((id) => child.text.toLowerCase() === id);
    if (key && child.url) {
      urls[key] = child.url;
    }
  }
  return urls;
}

// Opens an app with the lab data source and one service already chosen, using each app's own URL parameters.
export function scopedAppUrl(app: AppId, base: string, service: string): string {
  // The nav entry for these apps is either the app root or its explore page.
  const root = base.replace(/\/(explore)?\/?$/, '');
  const filter = (key: string) => encodeURIComponent(`${key}|=|${service}`);
  switch (app) {
    case 'metrics':
      return `${base}?from=now-30m&to=now&var-ds=otel-lab-metrics&var-filters=${filter('service_name')}`;
    case 'logs':
      return `${root}/explore/service_name/${encodeURIComponent(service)}/logs?from=now-30m&to=now&var-ds=otel-lab-logs&var-filters=${filter('service_name')}`;
    case 'traces':
      return `${root}/explore?from=now-30m&to=now&var-ds=otel-lab-traces&var-filters=${filter('resource.service.name')}&primarySignal=all_spans`;
    default:
      return base;
  }
}
