import { Login } from './login';
import { AddDataSource } from './addDataSource';
import { DataSource } from './datasource';
import { DataSources } from './datasources';
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
import { SharePanelModal } from './sharePanelModal';
import { ConstantVariable, QueryVariable, VariableGeneral, Variables, VariablesSubMenu } from './variables';

export const Pages = {
  Login,
  DataSource,
  DataSources,
  AddDataSource,
  ConfirmModal,
  AddDashboard,
  Dashboard: {
    visit: (uid: string) => Dashboard.visit(uid),
    Toolbar: Dashboard,
    SubMenu: VariablesSubMenu,
    Settings: {
      General: DashboardSettings,
      Variables: {
        List: Variables,
        Edit: {
          General: VariableGeneral,
          QueryVariable: QueryVariable,
          ConstantVariable: ConstantVariable,
        },
      },
    },
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
  },
  Dashboards,
  SaveDashboardAsModal,
  SaveDashboardModal,
  SharePanelModal,
};
