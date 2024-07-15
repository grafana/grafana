const BREAKDOWN_LAYOUT_TYPES = ['single', 'grid', 'rows'] as const;

export type BreakdownLayoutType = (typeof BREAKDOWN_LAYOUT_TYPES)[number];

export function isBreakdownLayoutType(
  breakdownLayoutType: string | null | undefined
): breakdownLayoutType is BreakdownLayoutType {
  return !!breakdownLayoutType && breakdownLayoutType in BREAKDOWN_LAYOUT_TYPES;
}
