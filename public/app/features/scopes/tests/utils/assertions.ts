import { click } from './actions';
import {
  getDashboard,
  getDashboardFolderExpand,
  queryAllDashboard,
  queryDashboard,
  queryDashboardFolderExpand,
} from './selectors';

export const expectInDocument = (selector: () => HTMLElement) => expect(selector()).toBeInTheDocument();
export const expectNotInDocument = (selector: () => HTMLElement | null) => expect(selector()).not.toBeInTheDocument();
export const expectChecked = (selector: () => HTMLInputElement) => expect(selector()).toBeChecked();
export const expectRadioChecked = (selector: () => HTMLInputElement) => expect(selector().checked).toBe(true);
export const expectRadioNotChecked = (selector: () => HTMLInputElement) => expect(selector().checked).toBe(false);
export const expectValue = (selector: () => HTMLInputElement, value: string) => expect(selector().value).toBe(value);
export const expectTextContent = (selector: () => HTMLElement, text: string) =>
  expect(selector()).toHaveTextContent(text);
export const expectDashboardFolderNotInDocument = (uid: string) =>
  expectNotInDocument(() => queryDashboardFolderExpand(uid));
export const expectDashboardInDocument = (uid: string) => expectInDocument(() => getDashboard(uid));
export const expectDashboardNotInDocument = (uid: string) => expectNotInDocument(() => queryDashboard(uid));
export const expandDashboardFolder = (folder: string) => click(() => getDashboardFolderExpand(folder));
export const expectDashboardLength = (uid: string, length: number) =>
  expect(queryAllDashboard(uid)).toHaveLength(length);
export const expectDisabled = (selector: () => HTMLElement) => expect(selector()).toBeDisabled();
