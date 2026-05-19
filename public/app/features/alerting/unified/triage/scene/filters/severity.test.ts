import { SEVERITY_DEFINITIONS, canonicalSeverity, severityFilterRegex } from './severity';

describe('SEVERITY_DEFINITIONS', () => {
  it('defines four severity levels in ascending order', () => {
    expect(SEVERITY_DEFINITIONS.map((d) => d.level)).toEqual(['low', 'minor', 'major', 'critical']);
  });

  it('assigns correct bar counts', () => {
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'low')?.bars).toBe(1);
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'minor')?.bars).toBe(2);
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'major')?.bars).toBe(3);
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'critical')?.bars).toBe(4);
  });

  it('includes SEV variants in the correct levels', () => {
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'low')?.values).toContain('SEV4');
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'minor')?.values).toContain('SEV3');
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'major')?.values).toContain('SEV2');
    expect(SEVERITY_DEFINITIONS.find((d) => d.level === 'critical')?.values).toContain('SEV1');
  });
});

describe('severityFilterRegex', () => {
  it('returns a case-insensitive regex for low', () => {
    expect(severityFilterRegex('low')).toBe('(?i)low|info|notice|SEV4');
  });

  it('returns a case-insensitive regex for minor', () => {
    expect(severityFilterRegex('minor')).toBe('(?i)minor|medium|warning|warn|moderate|SEV3');
  });

  it('returns a case-insensitive regex for major', () => {
    expect(severityFilterRegex('major')).toBe('(?i)major|high|SEV2');
  });

  it('returns a case-insensitive regex for critical', () => {
    expect(severityFilterRegex('critical')).toBe('(?i)critical|crit|fatal|SEV1');
  });
});

describe('canonicalSeverity', () => {
  it.each([
    ['low', 'low'],
    ['info', 'low'],
    ['notice', 'low'],
    ['SEV4', 'low'],
    ['minor', 'minor'],
    ['medium', 'minor'],
    ['warning', 'minor'],
    ['warn', 'minor'],
    ['moderate', 'minor'],
    ['SEV3', 'minor'],
    ['major', 'major'],
    ['high', 'major'],
    ['SEV2', 'major'],
    ['critical', 'critical'],
    ['crit', 'critical'],
    ['fatal', 'critical'],
    ['SEV1', 'critical'],
  ])('maps %s to %s', (input, expected) => {
    expect(canonicalSeverity(input)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(canonicalSeverity('LOW')).toBe('low');
    expect(canonicalSeverity('WARNING')).toBe('minor');
    expect(canonicalSeverity('HIGH')).toBe('major');
    expect(canonicalSeverity('CRITICAL')).toBe('critical');
    expect(canonicalSeverity('sev1')).toBe('critical');
    expect(canonicalSeverity('sev4')).toBe('low');
  });

  it('returns undefined for unknown values', () => {
    expect(canonicalSeverity('unknown')).toBeUndefined();
    expect(canonicalSeverity('')).toBeUndefined();
    expect(canonicalSeverity('error')).toBeUndefined();
  });
});
