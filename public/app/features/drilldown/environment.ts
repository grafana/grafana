import { locationService } from '@grafana/runtime';

// The chosen environment lives in the URL as a variable, the same `var-` form the data sources use.
export const environmentParam = 'var-environment';

// Read straight from the URL so links and queries agree.
export function getUrlEnvironment(): string | undefined {
  const value = locationService.getSearchObject()[environmentParam];
  return typeof value === 'string' && value ? value : undefined;
}
