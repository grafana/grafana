import { type BadgeColor } from '@grafana/ui';
import { SEVERITY_DEFINITIONS, type SeverityLevel } from 'app/features/alerting/unified/triage/scene/filters/severity';

/** BadgeColor for a canonical severity level; shared by both home cards' severity badges. */
export function severityLevelColor(level: SeverityLevel | undefined): BadgeColor {
  switch (level) {
    case 'critical':
      return 'red';
    case 'major':
      return 'orange';
    default:
      return 'darkgrey';
  }
}

/** Ascending severity rank (higher = more severe); undefined/unmapped sorts lowest. */
export function severityLevelRank(level: SeverityLevel | undefined): number {
  return level ? SEVERITY_DEFINITIONS.findIndex((d) => d.level === level) : -1;
}
