import { DashboardModel } from '../dashboard_model';
import { PanelLoader } from './PanelLoader';

export interface PanelContainer {
  getPanelLoader(): PanelLoader;
  getDashboard(): DashboardModel;
}
