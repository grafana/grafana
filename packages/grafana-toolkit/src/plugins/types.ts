import { PluginMeta, KeyValue } from '@grafana/data';

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
  git?: GitLogInfo;
  pullRequest?: number;
  artifactsBaseURL?: string;
  grafanaVersion?: KeyValue<string>;
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

export interface CountAndSize {
  count: number;
  bytes: number;
}

export interface ExtensionSize {
  [key: string]: CountAndSize;
}

export interface ZipFileInfo {
  name: string;
  size: number;
  contents: ExtensionSize;
  sha1?: string;
  md5?: string;
}

interface UserInfo {
  name: string;
  email: string;
  time?: number;
}

export interface GitLogInfo {
  commit: string;
  tree: string;
  subject: string;
  body?: string;
  notes?: string;
  author: UserInfo;
  commiter: UserInfo;
}

export interface ManifestInfo {
  // time: number;  << filled in by the server
  // keyId: string; << filled in by the server
  plugin: string;
  version: string;
  files: Record<string, string>;
}
