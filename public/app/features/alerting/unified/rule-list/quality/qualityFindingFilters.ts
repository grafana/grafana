import { type IncompleteRule } from '../../hooks/useIncompleteRules';
import { Annotation } from '../../utils/constants';

/**
 * Severity derived from a finding. A missing runbook URL leaves responders with nowhere
 * to start, so it's high; any other missing annotation is medium. Low is reserved for
 * future finding types and is never produced by the current detectors.
 */
export type QualitySeverity = 'high' | 'medium' | 'low';

/** Severity filter value, including the "all" pass-through. */
export type SeverityFilterValue = 'all' | QualitySeverity;

/** Selectable severity tiers, in display order. */
export const QUALITY_SEVERITIES: QualitySeverity[] = ['high', 'medium', 'low'];

/** The annotation finding types surfaced on the Alert quality tab today. */
export type FindingType = Annotation.summary | Annotation.description | Annotation.runbookURL;

/** Number of in-scope findings per finding type. */
export type FindingTypeCounts = Record<FindingType, number>;

/** Number of in-scope rules per derived severity. */
export type SeverityCounts = Record<QualitySeverity, number>;

/**
 * The finding types surfaced on the Alert quality tab today, in display order. Each maps
 * to a required annotation that, when missing, flags a rule as incomplete.
 */
export const FINDING_TYPES: FindingType[] = [Annotation.summary, Annotation.description, Annotation.runbookURL];

/**
 * Derive a finding's severity. Missing a runbook URL is high; otherwise medium.
 */
export function getRuleSeverity(rule: IncompleteRule): QualitySeverity {
  return rule.missing.includes(Annotation.runbookURL) ? 'high' : 'medium';
}

/**
 * Count how many of the given rules are missing each finding type. A rule missing several
 * annotations contributes to several counts.
 */
export function getFindingTypeCounts(rules: IncompleteRule[]): FindingTypeCounts {
  const counts: FindingTypeCounts = {
    [Annotation.summary]: 0,
    [Annotation.description]: 0,
    [Annotation.runbookURL]: 0,
  };

  for (const rule of rules) {
    for (const type of FINDING_TYPES) {
      if (rule.missing.includes(type)) {
        counts[type]++;
      }
    }
  }

  return counts;
}

/**
 * Count how many of the given rules fall into each severity tier.
 */
export function getSeverityCounts(rules: IncompleteRule[]): SeverityCounts {
  const counts: SeverityCounts = { high: 0, medium: 0, low: 0 };

  for (const rule of rules) {
    counts[getRuleSeverity(rule)]++;
  }

  return counts;
}

interface FindingFilters {
  severity: SeverityFilterValue;
  /** Finding types to keep. An empty array matches every finding type. */
  findingTypes: FindingType[];
}

/**
 * Filter findings by severity and finding type. The two dimensions are ANDed together: a
 * rule must match the selected severity (unless "all") and, when finding types are selected,
 * be missing at least one of them (the finding types are ORed among themselves).
 */
export function filterFindings(rules: IncompleteRule[], { severity, findingTypes }: FindingFilters): IncompleteRule[] {
  return rules.filter((rule) => {
    if (severity !== 'all' && getRuleSeverity(rule) !== severity) {
      return false;
    }
    if (findingTypes.length > 0 && !findingTypes.some((type) => rule.missing.includes(type))) {
      return false;
    }
    return true;
  });
}
