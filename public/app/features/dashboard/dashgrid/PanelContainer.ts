import {PanelModel} from '../PanelModel';
import {DashboardModel}  from '../model';
import {PanelLoader} from './PanelLoader';

export interface PanelContainer {
  getPanels(): PanelModel[];
  getPanelLoader(): PanelLoader;
  getDashboard(): DashboardModel;
  panelPossitionUpdated(panel: PanelModel);
}

