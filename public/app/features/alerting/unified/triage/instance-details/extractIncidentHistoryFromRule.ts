import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

export type IncidentHistoryContext = Record<string, unknown>;

const INCIDENT_ANNOTATION_KEYS = ['grafana_incident_uid', 'incident_uid', 'irm_incident_uid'] as const;

function isIncidentHistoryContext(value: unknown): value is IncidentHistoryContext {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readMetadataIncidentHistory(metadata: unknown): IncidentHistoryContext | undefined {
  if (metadata === undefined || metadata === null || typeof metadata !== 'object') {
    return undefined;
  }

  let incidentHistory: unknown;

  if ('incident_history' in metadata) {
    incidentHistory = metadata.incident_history;
  } else if ('incidentHistory' in metadata) {
    incidentHistory = metadata.incidentHistory;
  } else {
    return undefined;
  }

  if (isIncidentHistoryContext(incidentHistory)) {
    return incidentHistory;
  }

  return undefined;
}

export function extractIncidentHistoryFromRule(rule: RulerGrafanaRuleDTO): IncidentHistoryContext | undefined {
  const fromMetadata = readMetadataIncidentHistory(rule.grafana_alert.metadata);

  if (fromMetadata) {
    return fromMetadata;
  }

  const annotations = rule.annotations ?? {};
  const linkedAnnotations: Record<string, string> = {};

  for (const key of INCIDENT_ANNOTATION_KEYS) {
    const value = annotations[key];

    if (value) {
      linkedAnnotations[key] = value;
    }
  }

  if (Object.keys(linkedAnnotations).length === 0) {
    return undefined;
  }

  return { annotations: linkedAnnotations };
}
