import { Login } from './login';
import { DataSource } from './datasource';
import { DataSources } from './datasources';
import { AddDataSource } from './addDataSource';
import { ConfirmModal } from './confirmModal';
import { AddDashboard } from './addDashboard';
import { Dashboard } from './dashboard';
import { SaveDashboardAsModal } from './saveDashboardAsModal';
import { Dashboards } from './dashboards';
import { DashboardSettings } from './dashboardSettings';
import { EditPanel } from './editPanel';
import { TestData } from './testdata';
import { Graph } from './graph';
import { SaveDashboardModal } from './saveDashboardModal';
import { Panel } from './panel';

export const Selectors = {
  Login,
  DataSource,
  DataSources,
  AddDataSource,
  ConfirmModal,
  AddDashboard,
  Dashboard,
  Dashboards,
  SaveDashboardAsModal,
  SaveDashboardModal,
  DashboardSettings,
  Panels: {
    Panel,
    EditPanel,
    DataSource: {
      TestData,
    },
    Visualization: {
      Graph,
    },
  },
};
