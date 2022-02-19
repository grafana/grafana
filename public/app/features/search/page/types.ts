export interface DashboardResult {
  UID: string;
  URL: string;
  Name: string;
  Description: string;
  Created: number;
  Updated: number;
}

export interface PanelResult {
  DashboardID: number;
  ID: number;
  Name: string;
  Description: string;
  Type: string;
}
