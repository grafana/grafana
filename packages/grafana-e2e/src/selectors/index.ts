import { Login } from './login';
import { DataSource } from './datasource';
import { DataSources } from './datasources';
import { AddDataSource } from './addDataSource';
import { ConfirmModal } from './confirmModal';
import { AddDashboard } from './addDashboard';
import { Dashboard } from './dashboard';
import { SaveAsModal } from './saveAsModal';
import { Dashboards } from './dashboards';
import { DashboardSettings } from './dashboardSettings';
import { EditPanel } from './editPanel';
import { TestData } from './testdata';
import { Graph } from './graph';

export const Selectors = {
  Login,
  DataSource,
  DataSources,
  AddDataSource,
  ConfirmModal,
  AddDashboard,
  Dashboard,
  Dashboards,
  SaveAsModal,
  DashboardSettings,
  Panels: {
    EditPanel,
    DataSource: {
      TestData,
    },
    Visualization: {
      Graph,
    },
  },
};
