export interface HistoryListOpts {
  limit: number;
  start: number;
  orderBy: string;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  dashboardId: number;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
}
