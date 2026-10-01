/** Types shared by the "Generate dashboard" prompt. */

export interface PromptDatasource {
  uid: string;
  type: string;
  name?: string;
}

export interface PromptDashboardRef {
  uid: string;
  title: string;
}
