export interface Spec {
  canAccessInstance: boolean;
  diagnosticData?: Record<string, unknown>;
  githubIssueUrl?: string;
  imageType?: string;
  message: string;
  reporterEmail?: string;
  screenshot?: string;
  screenshotUrl?: string;
}
