export type SeverityLevel = 'low' | 'minor' | 'major' | 'critical';

export interface SeverityDefinition {
  level: SeverityLevel;
  values: string[];
  bars: number;
}

export const SEVERITY_DEFINITIONS: SeverityDefinition[] = [
  { level: 'low', values: ['low', 'info', 'notice', 'SEV4'], bars: 1 },
  { level: 'minor', values: ['minor', 'medium', 'warning', 'warn', 'moderate', 'SEV3'], bars: 2 },
  { level: 'major', values: ['major', 'high', 'SEV2'], bars: 3 },
  { level: 'critical', values: ['critical', 'crit', 'fatal', 'SEV1'], bars: 4 },
];

export function severityFilterRegex(level: SeverityLevel): string {
  const def = SEVERITY_DEFINITIONS.find((d) => d.level === level);
  if (!def) {
    return level;
  }
  return `(?i)${def.values.join('|')}`;
}

export function canonicalSeverity(value: string): SeverityLevel | undefined {
  const lower = value.toLowerCase();
  return SEVERITY_DEFINITIONS.find((d) => d.values.some((v) => v.toLowerCase() === lower))?.level;
}
