import { SEVERITY_DEFINITIONS, type SeverityLevel } from 'app/features/alerting/unified/triage/scene/filters/severity';

/** Ascending severity rank (higher = more severe); undefined/unmapped sorts lowest. */
export function severityLevelRank(level: SeverityLevel | undefined): number {
  return level ? SEVERITY_DEFINITIONS.findIndex((d) => d.level === level) : -1;
}
