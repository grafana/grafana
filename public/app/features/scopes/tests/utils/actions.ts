import { act, fireEvent } from '@testing-library/react';

import { DateTime, makeTimeRange, dateMath } from '@grafana/data';
import { MultiValueVariable, sceneGraph, VariableValue } from '@grafana/scenes';
import { defaultTimeZone, TimeZone } from '@grafana/schema';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { scopesSelectorScene } from '../../instance';

import {
  dashboardReloadSpy,
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getMock,
} from './mocks';
import {
  getDashboardFolderExpand,
  getDashboardsExpand,
  getDashboardsSearch,
  getNotFoundForFilterClear,
  getPersistedApplicationsMimirSelect,
  getResultApplicationsCloudDevSelect,
  getResultApplicationsCloudExpand,
  getResultApplicationsCloudSelect,
  getResultApplicationsExpand,
  getResultApplicationsGrafanaSelect,
  getResultApplicationsMimirSelect,
  getResultCloudDevRadio,
  getResultCloudExpand,
  getResultCloudOpsRadio,
  getResultCloudSelect,
  getSelectorApply,
  getSelectorCancel,
  getSelectorInput,
  getTreeSearch,
} from './selectors';

export const clearMocks = () => {
  fetchNodesSpy.mockClear();
  fetchScopeSpy.mockClear();
  fetchSelectedScopesSpy.mockClear();
  fetchDashboardsSpy.mockClear();
  dashboardReloadSpy.mockClear();
  getMock.mockClear();
};

const click = async (selector: () => HTMLElement) => act(() => fireEvent.click(selector()));
const type = async (selector: () => HTMLInputElement, value: string) => {
  await act(() => fireEvent.input(selector(), { target: { value } }));
  await jest.runOnlyPendingTimersAsync();
};

export const updateScopes = async (scopes: string[]) =>
  act(async () =>
    scopesSelectorScene?.updateScopes(
      scopes.map((scopeName) => ({
        scopeName,
        path: [],
      }))
    )
  );
export const openSelector = async () => click(getSelectorInput);
export const applyScopes = async () => {
  await click(getSelectorApply);
  await jest.runOnlyPendingTimersAsync();
};
export const cancelScopes = async () => click(getSelectorCancel);
export const searchScopes = async (value: string) => type(getTreeSearch, value);
export const clearScopesSearch = async () => type(getTreeSearch, '');
export const expandResultApplications = async () => click(getResultApplicationsExpand);
export const expandResultApplicationsCloud = async () => click(getResultApplicationsCloudExpand);
export const expandResultCloud = async () => click(getResultCloudExpand);
export const selectResultApplicationsGrafana = async () => click(getResultApplicationsGrafanaSelect);
export const selectPersistedApplicationsMimir = async () => click(getPersistedApplicationsMimirSelect);
export const selectResultApplicationsMimir = async () => click(getResultApplicationsMimirSelect);
export const selectResultApplicationsCloud = async () => click(getResultApplicationsCloudSelect);
export const selectResultApplicationsCloudDev = async () => click(getResultApplicationsCloudDevSelect);
export const selectResultCloud = async () => click(getResultCloudSelect);
export const selectResultCloudDev = async () => click(getResultCloudDevRadio);
export const selectResultCloudOps = async () => click(getResultCloudOpsRadio);

export const toggleDashboards = async () => click(getDashboardsExpand);
export const searchDashboards = async (value: string) => type(getDashboardsSearch, value);
export const clearNotFound = async () => click(getNotFoundForFilterClear);
export const expandDashboardFolder = (folder: string) => click(() => getDashboardFolderExpand(folder));

export const enterEditMode = async (dashboardScene: DashboardScene) =>
  act(async () => dashboardScene.onEnterEditMode());

export const updateTimeRange = async (
  dashboardScene: DashboardScene,
  from: DateTime | string = 'now-6h',
  to: DateTime | string = 'now',
  timeZone: TimeZone = defaultTimeZone
) =>
  act(async () =>
    sceneGraph
      .getTimeRange(dashboardScene)
      .onTimeRangeChange(makeTimeRange(dateMath.parse(from, false, timeZone)!, dateMath.parse(to, false, timeZone)!))
  );

export const updateVariable = async (dashboardScene: DashboardScene, name: string, value: VariableValue) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const variable = sceneGraph.lookupVariable(name, dashboardScene) as MultiValueVariable;

  return act(async () => variable.changeValueTo(value));
};

export const updateMyVar = async (dashboardScene: DashboardScene, value: '1' | '2') =>
  updateVariable(dashboardScene, 'myVar', value);
