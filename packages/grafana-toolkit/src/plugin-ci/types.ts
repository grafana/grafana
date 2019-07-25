import { PluginMeta, PluginBuildInfo } from '@grafana/ui';
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
  pullRequest?: number;
  artifactsBaseURL?: string;
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
    info: PluginDevInfo;
    report: PluginBuildReport;
  };
  size: DataFrame[]; // New frame for each package
  coverage: DataFrame[]; // New frame for each job
  timing: DataFrame[]; // New frame for each job/workflow
}

export interface PluginDevInfo {
  pluginId: string;
  name: string;
  logos?: {
    large: string;
    small: string;
  };
  build: PluginBuildInfo;
  version: string;
}

export interface DevSummary {
  [key: string]: PluginDevInfo;
}

export interface PluginDevSummary {
  branch: DevSummary;
  pr: DevSummary;
}

export const defaultPluginHistory: PluginHistory = {
  last: {
    info: {} as PluginDevInfo,
    report: {} as PluginBuildReport,
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

export function appendPluginHistory(report: PluginBuildReport, info: PluginDevInfo, history: PluginHistory) {
  history.last = {
    info,
    report,
  };

  if (!history.size) {
    history.size = [];
  }

  console.log('TODO, append build stats to the last one');
}
