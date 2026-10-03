import { type PluginExtensionEventHelpers, PluginExtensionPoints } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import {
  getNotebookCaptureSidebarExtension,
  NOTEBOOK_CAPTURE_SIDEBAR_TITLE,
} from './getNotebookCaptureSidebarExtension';

jest.mock('app/core/services/context_srv');

const contextSrvMock = jest.mocked(contextSrv);

describe('getNotebookCaptureSidebarExtension', () => {
  afterEach(() => {
    contextSrvMock.hasPermission.mockRestore();
    setTestFlags({});
  });

  it('is available away from notebook routes when the feature and permission are present', () => {
    contextSrvMock.hasPermission.mockReturnValue(true);
    setTestFlags({ [FlagKeys.DashboardNotebooks]: true });

    const extension = getNotebookCaptureSidebarExtension();

    expect(extension.configure?.(undefined)).toBeUndefined();
    expect(extension.configure?.({ path: '/explore' })).toEqual({});
    expect(extension.configure?.({ path: '/notebooks' })).toBeUndefined();
    expect(extension.configure?.({ path: '/notebooks/nb1' })).toBeUndefined();
  });

  it('is hidden when notebooks are disabled or the user cannot write them', () => {
    contextSrvMock.hasPermission.mockReturnValue(true);
    setTestFlags({ [FlagKeys.DashboardNotebooks]: false });
    expect(getNotebookCaptureSidebarExtension().configure?.({ path: '/explore' })).toBeUndefined();

    contextSrvMock.hasPermission.mockReturnValue(false);
    setTestFlags({ [FlagKeys.DashboardNotebooks]: true });
    expect(getNotebookCaptureSidebarExtension().configure?.({ path: '/explore' })).toBeUndefined();
  });

  it('opens the matching sidebar component', () => {
    const openSidebar = jest.fn();
    const extension = getNotebookCaptureSidebarExtension();

    extension.onClick?.(undefined, {
      extensionPointId: PluginExtensionPoints.ExtensionSidebar,
      openSidebar,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the handler reads only openSidebar
    } as unknown as PluginExtensionEventHelpers);

    expect(openSidebar).toHaveBeenCalledWith(NOTEBOOK_CAPTURE_SIDEBAR_TITLE);
  });
});
