export interface Annotation {
  id: number;
  alertId: number; // will be zero for non-alert
  alertName: string;
  dashboardId: number;
  panelId: number;
  userId: number;
  newState: string;
  prevState: string;
  created: number;
  updated: number;
  time: number;
  text: string;
  regionId: number;
  tags: string[];
  login: string;
  email: string;
  avatarUrl: string;
  data: any;
}
