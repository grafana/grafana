export interface InsightQuestion {
  id: string;
  question: string;
  sourcePanelKeys: string[];
}

/** Exact over every original point, even when the values are bucket averages. */
export interface InsightFieldStats {
  count: number;
  first: number;
  firstAt: string;
  last: number;
  lastAt: string;
  min: number;
  minAt: string;
  max: number;
  maxAt: string;
  mean: number;
}

export interface InsightSnapshotField {
  name: string;
  type: string;
  unit?: string;
  labels?: Record<string, string>;
  values: unknown[];
  stats?: InsightFieldStats;
}

export interface InsightFrameSummary {
  note: string;
  originalRows: number;
  buckets: number;
  bucketSeconds: number;
}

export interface InsightSnapshotFrame {
  name?: string;
  /** Present when the frame had too many points to send exactly. */
  summary?: InsightFrameSummary;
  fields: InsightSnapshotField[];
}

export interface InsightSnapshotPanel {
  key: string;
  title: string;
  description: string;
  /** The tab and row the panel sits in, such as "LLM usage › Tokens". */
  section?: string;
  frames: InsightSnapshotFrame[];
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
  /** Off-screen sources are loading before the question is sent. */
  loadingSources?: boolean;
  result?: InsightResult;
  error?: string;
}
