import { type HealthModelEntity } from './types';

export interface EntitySignalStatus {
  /** Best available label for the signal. */
  name: string;
  healthState?: string;
  reportedAt?: string;
  value?: number;
}

export interface EntityHealthMetrics {
  signals: EntitySignalStatus[];
  /** Azure Resource Health availability, when the entity is backed by an Azure resource. */
  availabilityState?: string;
  /** Human readable resource health summary, when present. */
  summary?: string;
  /** Alert severities configured on the entity, most severe first. */
  alertSeverities: string[];
}

interface SignalStatusLike {
  healthState?: unknown;
  reportedAt?: unknown;
  value?: unknown;
  availabilityState?: unknown;
  summary?: unknown;
}

/**
 * Extracts the last reported health signals for an entity.
 *
 * `signalGroups` is a preview shape that nests status objects at different depths — Azure Resource
 * Health reports under `azureResource.resourceHealth.status`, while Log Analytics reports under
 * `azureLogAnalytics.signals[].status`. Rather than hard-coding those paths, this walks the tree
 * and collects any object that looks like a signal status, so new signal kinds surface without a
 * code change.
 */
export function getEntityHealthMetrics(entity: HealthModelEntity): EntityHealthMetrics {
  const signals: EntitySignalStatus[] = [];
  let availabilityState: string | undefined;
  let summary: string | undefined;

  const visit = (value: unknown, label: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, label);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    const ownLabel = readString(value.displayName) ?? readString(value.signalName) ?? readString(value.name) ?? label;

    const status = value.status;
    if (isRecord(status) && isSignalStatus(status)) {
      signals.push({
        name: ownLabel,
        healthState: readString(status.healthState),
        reportedAt: readString(status.reportedAt),
        value: typeof status.value === 'number' ? status.value : undefined,
      });

      availabilityState = availabilityState ?? readString(status.availabilityState);
      summary = summary ?? readString(status.summary);
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === 'status') {
        continue;
      }
      visit(child, ownLabel === label ? toLabel(key) : ownLabel);
    }
  };

  for (const [groupName, group] of Object.entries(entity.properties?.signalGroups ?? {})) {
    visit(group, toLabel(groupName));
  }

  // Newest first, so the most recently reported signals lead.
  signals.sort((left, right) => compareTimestampsDescending(left.reportedAt, right.reportedAt));

  return {
    signals,
    availabilityState,
    summary,
    alertSeverities: getAlertSeverities(entity),
  };
}

const SEVERITY_ORDER = ['sev0', 'sev1', 'sev2', 'sev3', 'sev4'];

function getAlertSeverities(entity: HealthModelEntity): string[] {
  const severities = new Set<string>();
  for (const alert of Object.values(entity.properties?.alerts ?? {})) {
    const severity = alert?.severity;
    if (severity) {
      severities.add(severity);
    }
  }

  return [...severities].sort((left, right) => {
    const leftIndex = SEVERITY_ORDER.indexOf(left.toLowerCase());
    const rightIndex = SEVERITY_ORDER.indexOf(right.toLowerCase());
    if (leftIndex === -1 || rightIndex === -1) {
      // Only reached for severities outside the known Sev0-Sev4 set, and the list is the distinct
      // severities configured on a single entity, so it is always small.
      // eslint-disable-next-line @grafana/no-locale-compare
      return left.localeCompare(right);
    }
    return leftIndex - rightIndex;
  });
}

/** A status is only useful here when it carries a health state or a report timestamp. */
function isSignalStatus(value: SignalStatusLike): boolean {
  return typeof value.healthState === 'string' || typeof value.reportedAt === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function compareTimestampsDescending(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);

  if (leftValid && rightValid) {
    return rightTime - leftTime;
  }
  // Signals without a usable timestamp sort last so they never mask a real reading.
  return leftValid ? -1 : rightValid ? 1 : 0;
}

/** Turns a camelCase group key such as `azureLogAnalytics` into `Azure log analytics`. */
function toLabel(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
