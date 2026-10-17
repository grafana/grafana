/**
 * Annotation keys the alerting API sets on its entities.
 *
 * Kubernetes models `metadata.annotations` as a plain string map, shared by every
 * resource, so these keys cannot come from the generated client and are declared here
 * instead. Keep them in step with the permission mappers in
 * pkg/registry/apps/alerting/notifications.
 */
import { type MergeDeep, type OverrideProperties } from 'type-fest';

import type { ListReceiverApiResponse, Receiver } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

// Receiver with its annotations typed. The integrations are a discriminated union in
// the generated client, so they no longer need overriding here.
// ⚠️ MergeDeep does not check if the property you are overriding exists in the base type and there is no "DeepOverrideProperties" helper
export type ContactPoint = MergeDeep<
  Receiver,
  {
    metadata: {
      annotations: ContactPointMetadataAnnotations;
    };
  }
>;

export type ContactPointMetadataAnnotations = AlertingEntityMetadataAnnotations &
  Partial<{
    // these three permissions only apply to contact points / receivers, not to the
    // other alerting entities
    'grafana.com/access/canReadSecrets': 'true';
    'grafana.com/access/canModifyProtected': 'true';
    'grafana.com/access/canTest': 'true';
    'grafana.com/inUse/routes': `${number}`;
    'grafana.com/inUse/rules': `${number}`;
  }>;

export type AlertingEntityMetadataAnnotations = Partial<{
  // The server writes an access annotation only when the user has that permission, and
  // always with the value "true" - there is no "false". Check for the key, not the value.
  'grafana.com/access/canAdmin': 'true';
  'grafana.com/access/canDelete': 'true';
  'grafana.com/access/canWrite': 'true';
  // canUse is different: it is always written, with either value
  'grafana.com/canUse': 'true' | 'false';
  // used for provisioning to identify what system created the entity
  'grafana.com/provenance': string;
}>;

export type EnhancedListReceiverApiResponse = OverrideProperties<
  ListReceiverApiResponse,
  {
    items: ContactPoint[];
  }
>;
