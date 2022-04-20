import { config } from '@grafana/runtime/src';

export function isTrial() {
  const settings = (config as any).licensing;
  return settings?.isTrial;
}

export const highlightTrial = () => isTrial() && config.featureToggles.featureHighlights;
