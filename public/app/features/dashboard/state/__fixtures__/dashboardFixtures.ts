import {
  AnnotationQuery,
  Dashboard,
  defaultDashboardCursorSync,
  defaultVariableModel,
  GraphPanel,
  Panel,
  RowPanel,
  VariableModel,
} from '@grafana/schema';
import { GetVariables } from 'app/features/variables/state/selectors';
import { DashboardMeta } from 'app/types';

import { DashboardModel } from '../DashboardModel';

export function createDashboardModelFixture(
  dashboardInput: Partial<Dashboard> = {},
  meta?: DashboardMeta,
  getVariablesFromState?: GetVariables
): DashboardModel {
  const dashboardJson: Dashboard = {
    editable: true,
    graphTooltip: defaultDashboardCursorSync,
    schemaVersion: 1,
    style: 'dark',
    timezone: '',
    ...dashboardInput,
  };

  return new DashboardModel(dashboardJson, meta, getVariablesFromState);
}

export function createPanelJSONFixture(panelInput: Partial<Panel | GraphPanel | RowPanel> = {}): Panel {
  return {
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    options: {},
    repeatDirection: 'h',
    transformations: [],
    transparent: false,
    type: 'timeseries',
    ...panelInput,
  };
}

export function createAnnotationJSONFixture(annotationInput: Partial<AnnotationQuery>): AnnotationQuery {
  return {
    builtIn: 0, // ??
    datasource: {
      type: 'foo',
      uid: 'bar',
    },
    showIn: 2,
    enable: true,
    type: 'anno',
    ...annotationInput,
  };
}

export function createVariableJSONFixture(annotationInput: Partial<VariableModel>): VariableModel {
  return {
    ...defaultVariableModel,
    name: 'foo.variable',
    type: 'constant',
    ...annotationInput,
  };
}
