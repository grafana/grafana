import {DashboardModel}  from '../DashboardModel';
import {PanelLoader} from './PanelLoader';

export interface PanelContainer {
  getPanelLoader(): PanelLoader;
  getDashboard(): DashboardModel;
}

