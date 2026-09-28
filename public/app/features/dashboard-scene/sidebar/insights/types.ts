export interface InsightQuestion {
  id: string;
  question: string;
  sourcePanelKeys: string[];
}

export interface InsightSnapshotField {
  name: string;
  type: string;
  unit?: string;
  labels?: Record<string, string>;
  values: unknown[];
}

export interface InsightSnapshotPanel {
  key: string;
  title: string;
  description: string;
  frames: Array<{ name?: string; fields: InsightSnapshotField[] }>;
}

export interface InsightSnapshot {
  question: string;
  dashboardUid: string;
  from: string;
  to: string;
  variables: Record<string, string>;
  panels: InsightSnapshotPanel[];
}

export type InsightContext = Omit<InsightSnapshot, 'panels'>;

export interface InsightAnswer {
  headline: string;
  findings: Array<{ label: string; detail: string }>;
  caveat: string;
}

export interface InsightResult {
  content: InsightAnswer;
  snapshot: InsightSnapshot;
  completedAt: string;
  sourceLocation: string;
}

export interface InsightRun {
  running: boolean;
  result?: InsightResult;
  error?: string;
}
