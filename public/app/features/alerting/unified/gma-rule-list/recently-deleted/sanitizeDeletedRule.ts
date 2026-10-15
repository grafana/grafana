import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyManagerAllowsEdits, AnnoKeyManagerIdentity, AnnoKeyManagerKind } from 'app/features/apiserver/types';

import { K8sAnnotations } from '../../utils/k8s/constants';

const PROVENANCE_ANNOTATION_KEYS: string[] = [
  K8sAnnotations.Provenance,
  AnnoKeyManagerKind,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerAllowsEdits,
];
const ACCESS_ANNOTATION_PREFIX = 'grafana.com/access/';
const GROUP_LABEL_PREFIX = 'grafana.com/group';

/** Strips tombstone internals and stale labels the create API rejects. */
export function sanitizeDeletedRule(rule: AlertRule): AlertRule;
export function sanitizeDeletedRule(rule: RecordingRule): RecordingRule;
export function sanitizeDeletedRule(rule: AlertRule | RecordingRule): AlertRule | RecordingRule;
export function sanitizeDeletedRule(rule: AlertRule | RecordingRule): AlertRule | RecordingRule {
  const { metadata, status, ...rest } = rule;
  const {
    deletionTimestamp,
    deletionGracePeriodSeconds,
    resourceVersion,
    managedFields,
    finalizers,
    annotations,
    labels,
    ...sanitizedMetadata
  } = metadata;

  const sanitizedAnnotations = filterEntries(
    annotations,
    (key) => !PROVENANCE_ANNOTATION_KEYS.includes(key) && !key.startsWith(ACCESS_ANNOTATION_PREFIX)
  );
  const sanitizedLabels = filterEntries(labels, (key) => !key.startsWith(GROUP_LABEL_PREFIX));

  return {
    ...rest,
    metadata: {
      ...sanitizedMetadata,
      ...(sanitizedAnnotations && Object.keys(sanitizedAnnotations).length > 0
        ? { annotations: sanitizedAnnotations }
        : {}),
      ...(sanitizedLabels && Object.keys(sanitizedLabels).length > 0 ? { labels: sanitizedLabels } : {}),
    },
  };
}

function filterEntries(
  record: Record<string, string> | undefined,
  predicate: (key: string) => boolean
): Record<string, string> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => predicate(key)));
}
