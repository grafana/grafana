import { act, fireEvent } from '@testing-library/react';

import { getDashboardAPI, setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { scopesSelectorScene } from '../../instance';

import {
  fetchDashboardsSpy,
  fetchNodesSpy,
  fetchScopeSpy,
  fetchSelectedScopesSpy,
  getMock,
  locationReloadSpy,
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
  locationReloadSpy.mockClear();
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

export const getDashboardDTO = async () => {
  setDashboardAPI(undefined);
  await getDashboardAPI().getDashboardDTO('1');
};
