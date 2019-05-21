import { DateTime } from '../utils/index';

export interface Annotation {
  id: number;
  alertId: number; // will be zero for non-alert
  alertName: string;
  dashboardId: number;
  panelId: number;
  userId: number;
  newState: string;
  prevState: string;
  created: DateTime;
  updated: DateTime;
  time: DateTime;
  text: string;
  regionId: number;
  tags: string[];
  login: string;
  email: string;
  avatarUrl: string;
  data: any;
}
