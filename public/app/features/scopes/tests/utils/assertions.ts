import {
  getDashboard,
  getDashboardsContainer,
  getDashboardsExpand,
  getDashboardsSearch,
  getNotFoundForFilter,
  getNotFoundForScope,
  getNotFoundNoScopes,
  getPersistedApplicationsMimirSelect,
  getRecentScopeSet,
  getRecentScopesSection,
  getResultApplicationsCloudSelect,
  getResultApplicationsGrafanaSelect,
  getResultApplicationsMimirSelect,
  getSelectorInput,
  getTreeHeadline,
  queryAllDashboard,
  queryDashboard,
  queryDashboardFolderExpand,
  queryDashboardsContainer,
  queryDashboardsSearch,
  queryPersistedApplicationsGrafanaSelect,
  queryPersistedApplicationsMimirSelect,
  queryRecentScopeSet,
  queryRecentScopesSection,
  queryResultApplicationsCloudSelect,
  queryResultApplicationsGrafanaSelect,
  queryResultApplicationsMimirSelect,
  getResultEnvironmentsDevSelect,
  getResultEnvironmentsProdSelect,
  querySelectorApply,
} from './selectors';

const expectInDocument = (selector: () => HTMLElement) => expect(selector()).toBeInTheDocument();
const expectNotInDocument = (selector: () => HTMLElement | null) => expect(selector()).not.toBeInTheDocument();
const expectChecked = (selector: () => HTMLInputElement) => expect(selector()).toBeChecked();
const expectNotChecked = (selector: () => HTMLInputElement) => expect(selector()).not.toBeChecked();

const expectValue = (selector: () => HTMLInputElement, value: string) => expect(selector().value).toBe(value);
const expectTextContent = (selector: () => HTMLElement, text: string) => expect(selector()).toHaveTextContent(text);
const expectDisabled = (selector: () => HTMLElement) => expect(selector()).toBeDisabled();

export const expectRecentScopeNotPresent = (scope: string) => expectNotInDocument(() => queryRecentScopeSet(scope));
export const expectRecentScope = (scope: string) => expectInDocument(() => getRecentScopeSet(scope));
export const expectRecentScopeNotPresentInDocument = () => expectNotInDocument(queryRecentScopesSection);
export const expectRecentScopesSection = () => expectInDocument(getRecentScopesSection);
export const expectScopesSelectorClosed = () => expectNotInDocument(querySelectorApply);
export const expectScopesSelectorDisabled = () => expectDisabled(getSelectorInput);
export const expectScopesSelectorValue = (value: string) => expectValue(getSelectorInput, value);
export const expectScopesHeadline = (value: string) => expectTextContent(getTreeHeadline, value);
export const expectPersistedApplicationsGrafanaNotPresent = () =>
  expectNotInDocument(queryPersistedApplicationsGrafanaSelect);
export const expectResultApplicationsGrafanaSelected = () => expectChecked(getResultApplicationsGrafanaSelect);
export const expectResultApplicationsGrafanaPresent = () => expectInDocument(getResultApplicationsGrafanaSelect);
export const expectResultApplicationsGrafanaNotPresent = () =>
  expectNotInDocument(queryResultApplicationsGrafanaSelect);
export const expectPersistedApplicationsMimirPresent = () => expectInDocument(getPersistedApplicationsMimirSelect);
export const expectPersistedApplicationsMimirNotPresent = () =>
  expectNotInDocument(queryPersistedApplicationsMimirSelect);
export const expectResultApplicationsMimirSelected = () => expectChecked(getResultApplicationsMimirSelect);
export const expectResultApplicationsMimirPresent = () => expectInDocument(getResultApplicationsMimirSelect);
export const expectResultApplicationsMimirNotPresent = () => expectNotInDocument(queryResultApplicationsMimirSelect);
export const expectResultApplicationsCloudPresent = () => expectInDocument(getResultApplicationsCloudSelect);
export const expectResultApplicationsCloudNotPresent = () => expectNotInDocument(queryResultApplicationsCloudSelect);

export const expectResultEnvironmentsDevSelected = () => expectChecked(getResultEnvironmentsDevSelect);
export const expectResultEnvironmentsDevNotSelected = () => expectNotChecked(getResultEnvironmentsDevSelect);
export const expectResultEnvironmentsProdSelected = () => expectChecked(getResultEnvironmentsProdSelect);
export const expectResultEnvironmentsProdNotSelected = () => expectNotChecked(getResultEnvironmentsProdSelect);

export const expectDashboardsDisabled = () => expectDisabled(getDashboardsExpand);
export const expectDashboardsClosed = () => expectNotInDocument(queryDashboardsContainer);
export const expectDashboardsOpen = () => expectInDocument(getDashboardsContainer);
export const expectNoDashboardsSearch = () => expectNotInDocument(queryDashboardsSearch);
export const expectDashboardsSearch = () => expectInDocument(getDashboardsSearch);
export const expectNoDashboardsNoScopes = () => expectInDocument(getNotFoundNoScopes);
export const expectNoDashboardsForScope = () => expectInDocument(getNotFoundForScope);
export const expectNoDashboardsForFilter = () => expectInDocument(getNotFoundForFilter);
export const expectDashboardSearchValue = (value: string) => expectValue(getDashboardsSearch, value);
export const expectDashboardFolderNotInDocument = (uid: string) =>
  expectNotInDocument(() => queryDashboardFolderExpand(uid));
export const expectDashboardInDocument = (uid: string) => expectInDocument(() => getDashboard(uid));
export const expectDashboardNotInDocument = (uid: string) => expectNotInDocument(() => queryDashboard(uid));
export const expectDashboardLength = (uid: string, length: number) =>
  expect(queryAllDashboard(uid)).toHaveLength(length);
