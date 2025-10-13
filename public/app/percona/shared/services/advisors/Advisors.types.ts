export enum Interval {
  STANDARD = 'Standard',
  RARE = 'Rare',
  FREQUENT = 'Frequent',
}

export const Family: { [key: string]: string } = {
  ADVISOR_CHECK_FAMILY_MYSQL: 'MySQL',
  ADVISOR_CHECK_FAMILY_POSTGRESQL: 'PostgreSQL',
  ADVISOR_CHECK_FAMILY_MONGODB: 'MongoDB',
};

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
  enabled: boolean;
  description: string;
  summary: string;
  interval: keyof typeof Interval;
  family?: string;
}

export interface CategorizedAdvisor {
  [category: string]: {
    [summary: string]: Advisor;
  };
}
