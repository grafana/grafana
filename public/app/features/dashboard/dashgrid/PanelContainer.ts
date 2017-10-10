import {DashboardModel}  from '../model';
import {PanelLoader} from './PanelLoader';

export interface PanelContainer {
  getPanelLoader(): PanelLoader;
  getDashboard(): DashboardModel;
}

