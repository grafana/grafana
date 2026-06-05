import { config } from '@grafana/runtime';

// Single source of truth for reading the `alerting.notificationsAPIV1Beta1` feature toggle. Each
// switching point calls this once at module load and stores the result in a `const` — flipping
// the toggle requires a page reload, which is intentional for this kill-switch.
export function isNotificationsAPIV1Beta1Enabled(): boolean {
  return Boolean(config.featureToggles['alerting.notificationsAPIV1Beta1']);
}
