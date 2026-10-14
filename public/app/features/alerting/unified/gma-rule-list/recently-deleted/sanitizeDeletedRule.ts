import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyManagerAllowsEdits, AnnoKeyManagerIdentity, AnnoKeyManagerKind } from 'app/features/apiserver/types';

const PROVENANCE_ANNOTATION_KEYS: string[] = [AnnoKeyManagerKind, AnnoKeyManagerIdentity, AnnoKeyManagerAllowsEdits];
const ACCESS_ANNOTATION_PREFIX = 'grafana.com/access/';
const GROUP_LABEL_PREFIX = 'grafana.com/group';

/**
 * Strips fields from a deleted `AlertRule`/`RecordingRule` that are either internal to this
 * tombstone (deletion metadata, resourceVersion, managedFields, finalizers), not useful to a
 * reader of the "Advanced: Kubernetes JSON" preview (status), or would carry stale ownership
 * into a future Restore (provenance/manager annotations, access annotations, and the legacy
 * `grafana.com/group`/`grafana.com/group-index` labels the group-free create API rejects).
 *
 * This is a pure function so Restore can reuse it later without depending on this page's UI.
 * Overloaded (rather than generic) so a caller passing an `AlertRule` gets an `AlertRule` back,
 * without needing a type assertion to reconstruct the sanitized object.
 */
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
