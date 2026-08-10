import { PluginExtensionPoints } from '@grafana/data';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';

import { getLastUsedNotebook } from '../model/lastUsedNotebook';

import { getNotebookExtensionConfigs } from './getNotebookExtensionConfigs';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));
jest.mock('app/core/services/context_srv');
jest.mock('../model/lastUsedNotebook', () => ({
  getLastUsedNotebook: jest.fn(),
}));

const getFeatureFlagClientMock = jest.mocked(getFeatureFlagClient);
const contextSrvMock = jest.mocked(contextSrv);
const getLastUsedNotebookMock = jest.mocked(getLastUsedNotebook);
const getBooleanValue = jest.fn();

describe('getNotebookExtensionConfigs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFeatureFlagClientMock.mockReturnValue({ getBooleanValue } as never);
    getBooleanValue.mockReturnValue(true);
    contextSrvMock.hasPermission.mockReturnValue(true);
    getLastUsedNotebookMock.mockReturnValue({ uid: 'nb-1', title: 'Investigation notes', at: 1 });
  });

  it('hides Explore capture actions when notebooks are disabled', () => {
    getBooleanValue.mockReturnValue(false);

    expect(configure('Add to notebook')).toBeUndefined();
    expect(configure('Add to last notebook')).toBeUndefined();
  });

  it('hides Explore capture actions without notebook write permissions', () => {
    contextSrvMock.hasPermission.mockReturnValue(false);

    expect(configure('Add to notebook')).toBeUndefined();
    expect(configure('Add to last notebook')).toBeUndefined();
  });

  it('only exposes quick capture when a last-used notebook exists', () => {
    expect(configure('Add to notebook')).toEqual({});
    expect(configure('Add to last notebook')).toEqual(
      expect.objectContaining({ title: 'Add to "Investigation notes"' })
    );

    getLastUsedNotebookMock.mockReturnValue(undefined);
    expect(configure('Add to last notebook')).toBeUndefined();
  });

  it('hides the editing sidebar without notebook write permissions', () => {
    contextSrvMock.hasPermission.mockReturnValue(false);
    const sidebar = getNotebookExtensionConfigs().find((config) =>
      config.targets.includes(PluginExtensionPoints.ExtensionSidebar)
    );

    expect(sidebar?.configure?.(undefined)).toBeUndefined();
  });
});

function configure(title: string) {
  const extension = getNotebookExtensionConfigs().find((config) => config.title === title);
  expect(extension).toBeDefined();
  return extension?.configure?.(undefined);
}
