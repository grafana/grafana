export enum Interval {
  STANDARD = 'Standard',
  RARE = 'Rare',
  FREQUENT = 'Frequent',
}

export interface Advisor {
  // Machine-readable name (ID) that is used in expression.
  name: string;
  // Long human-readable description.
  description: string;
  // Short human-readable summary.
  summary: string;
  // Comment.
  comment: string;
  // Category.
  category: string;
  // Advisor checks.
  checks: AdvisorCheck[];
}

export interface AdvisorCheck {
  name: string;
  disabled: boolean;
  description: string;
  summary: string;
  interval: keyof typeof Interval;
}

export interface CategorizedAdvisor {
  [category: string]: {
    [summary: string]: Advisor;
  };
}
