import { type AlertingEntityMetadataAnnotations } from '../api/notifications/v1beta1/types';

/** Entities imported from an external Alertmanager are flagged `grafana.com/canUse: 'false'` and are rejected by
 * rule validation. A missing annotation counts as unusable. */
export function hasCanUseEnabled(entity: { metadata?: { annotations?: AlertingEntityMetadataAnnotations } }): boolean {
  return entity.metadata?.annotations?.['grafana.com/canUse'] === 'true';
}
