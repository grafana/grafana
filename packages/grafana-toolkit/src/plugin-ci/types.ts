import { PluginMeta } from '@grafana/ui';
import { DataFrame } from '@grafana/data';

export interface PluginPackageDetails {
  plugin: ZipFileInfo;
  docs?: ZipFileInfo;
}

export interface PluginBuildReport {
  plugin: PluginMeta;
  packages: PluginPackageDetails;
  workflow: WorkflowInfo;
  coverage: CoverageInfo[];
  tests: TestResultsInfo[];
  pullRequest?: string;
}

export interface JobInfo {
  job?: string;
  startTime: number;
  endTime: number;
  elapsed: number;
  status?: string;
  buildNumber?: number;
}

export interface WorkflowInfo extends JobInfo {
  workflowId?: string;
  jobs: JobInfo[];
  user?: string;
  repo?: string;
}

export interface CoverageDetails {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageInfo {
  job: string;
  summary: { [key: string]: CoverageDetails };
  report?: string; // path to report
}

export interface TestResultsInfo {
  job: string;
  grafana?: any;
  error?: string;
  passed: number;
  failed: number;
  screenshots: string[];
}

// Saved at the folder level
export interface PluginHistory {
  last: {
    path: string;
    job: PluginBuildReport;
  };
  size: DataFrame[]; // New frame for each package
  coverage: DataFrame[]; // New frame for each job
  timing: DataFrame[]; // New frame for each job/workflow
}

export const defaultPluginHistory: PluginHistory = {
  last: {
    path: '?',
    job: {} as PluginBuildReport,
  },
  size: [],
  coverage: [],
  timing: [],
};

export interface ExtensionBytes {
  [key: string]: number;
}

export interface ZipFileInfo {
  name: string;
  size: number;
  contents: ExtensionBytes;
  sha1?: string;
  md5?: string;
}

export function appendPluginHistory(job: PluginBuildReport, path: string, history: PluginHistory) {
  history.last = {
    path,
    job,
  };

  if (!history.size) {
    history.size = [];
  }
}
