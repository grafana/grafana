export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SeverityDefinition {
  level: SeverityLevel;
  values: string[];
  bars: number;
}

export const SEVERITY_DEFINITIONS: SeverityDefinition[] = [
  { level: 'low', values: ['low', 'info', 'notice'], bars: 1 },
  { level: 'medium', values: ['medium', 'warning', 'warn', 'minor', 'moderate'], bars: 2 },
  { level: 'high', values: ['high', 'major'], bars: 3 },
  { level: 'critical', values: ['critical', 'crit', 'fatal'], bars: 4 },
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
  return SEVERITY_DEFINITIONS.find((d) => d.values.includes(lower))?.level;
}
