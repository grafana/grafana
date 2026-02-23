import { renderHook, waitFor } from '@testing-library/react';

import {
  getAppPluginMeta,
  getAppPluginMetas,
  getAppPluginVersion,
  isAppPluginInstalled,
  setAppPluginMetas,
} from './apps';
import {
  useAppPluginMeta,
  useAppPluginMetas,
  useAppPluginInstalled,
  useAppPluginVersion,
  useListedPanelPluginIds,
  usePanelPluginMeta,
  usePanelPluginMetas,
  usePanelPluginInstalled,
  usePanelPluginVersion,
  usePanelPluginMetasMap,
} from './hooks';
import {
  getListedPanelPluginIds,
  getPanelPluginMeta,
  getPanelPluginMetas,
  getPanelPluginMetasMap,
  getPanelPluginVersion,
  isPanelPluginInstalled,
  setPanelPluginMetas,
} from './panels';
import { apps } from './test-fixtures/config.apps';
import { panels } from './test-fixtures/config.panels';

const actualApps = jest.requireActual<typeof import('./apps')>('./apps');
const actualPanels = jest.requireActual<typeof import('./panels')>('./panels');
jest.mock('./apps', () => ({
  ...jest.requireActual('./apps'),
  getAppPluginMetas: jest.fn(),
  getAppPluginMeta: jest.fn(),
  isAppPluginInstalled: jest.fn(),
  getAppPluginVersion: jest.fn(),
}));
jest.mock('./panels', () => ({
  ...jest.requireActual('./panels'),
  getPanelPluginMeta: jest.fn(),
  getPanelPluginMetas: jest.fn(),
  getPanelPluginMetasMap: jest.fn(),
  isPanelPluginInstalled: jest.fn(),
  getPanelPluginVersion: jest.fn(),
  getListedPanelPluginIds: jest.fn(),
}));
const getAppPluginMetaMock = jest.mocked(getAppPluginMeta);
const getAppPluginMetasMock = jest.mocked(getAppPluginMetas);
const isAppPluginInstalledMock = jest.mocked(isAppPluginInstalled);
const getAppPluginVersionMock = jest.mocked(getAppPluginVersion);
const getPanelPluginMetaMock = jest.mocked(getPanelPluginMeta);
const getPanelPluginMetasMock = jest.mocked(getPanelPluginMetas);
const getPanelPluginMetasMapMock = jest.mocked(getPanelPluginMetasMap);
const isPanelPluginInstalledMock = jest.mocked(isPanelPluginInstalled);
const getPanelPluginVersionMock = jest.mocked(getPanelPluginVersion);
const getListedPanelPluginIdsMock = jest.mocked(getListedPanelPluginIds);

describe('useAppPluginMeta', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginMetaMock.mockImplementation(actualApps.getAppPluginMeta);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(apps['grafana-exploretraces-app']);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if useAppPluginMeta throws', async () => {
    getAppPluginMetaMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginMetas', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginMetasMock.mockImplementation(actualApps.getAppPluginMetas);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(Object.values(apps));
  });

  it('should return correct values if useAppPluginMetas throws', async () => {
    getAppPluginMetasMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginInstalled', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    isAppPluginInstalledMock.mockImplementation(actualApps.isAppPluginInstalled);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(true);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(false);
  });

  it('should return correct values if isAppPluginInstalled throws', async () => {
    isAppPluginInstalledMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginVersion', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginVersionMock.mockImplementation(actualApps.getAppPluginVersion);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual('1.2.2');
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if getAppPluginVersion throws', async () => {
    getAppPluginVersionMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginMeta', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    getPanelPluginMetaMock.mockImplementation(actualPanels.getPanelPluginMeta);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => usePanelPluginMeta('timeseries'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => usePanelPluginMeta('timeseries'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(panels['timeseries']);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => usePanelPluginMeta('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if usePanelPluginMeta throws', async () => {
    getPanelPluginMetaMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => usePanelPluginMeta('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginMetas', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    getPanelPluginMetasMock.mockImplementation(actualPanels.getPanelPluginMetas);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => usePanelPluginMetas());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => usePanelPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(Object.values(panels));
  });

  it('should return correct values if usePanelPluginMetas throws', async () => {
    getPanelPluginMetasMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => usePanelPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginMetasMap', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    getPanelPluginMetasMapMock.mockImplementation(actualPanels.getPanelPluginMetasMap);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => usePanelPluginMetasMap());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => usePanelPluginMetasMap());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(panels);
  });

  it('should return correct values if usePanelPluginMetasMap throws', async () => {
    getPanelPluginMetasMapMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => usePanelPluginMetasMap());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useListedPanelPluginIds', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    getListedPanelPluginIdsMock.mockImplementation(actualPanels.getListedPanelPluginIds);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useListedPanelPluginIds());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const hidden = Object.values(panels)
      .filter((p) => Boolean(p.hideFromList))
      .map((p) => p.id);
    const { result } = renderHook(() => useListedPanelPluginIds());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value?.some((p) => hidden.includes(p))).toEqual(false);
    expect(result.current.value).toEqual([
      'alertlist',
      'annolist',
      'barchart',
      'bargauge',
      'candlestick',
      'canvas',
      'dashlist',
      'flamegraph',
      'gauge',
      'geomap',
      'heatmap',
      'histogram',
      'logs',
      'news',
      'nodeGraph',
      'piechart',
      'stat',
      'state-timeline',
      'status-history',
      'table',
      'text',
      'timeseries',
      'traces',
      'trend',
      'xychart',
    ]);
  });

  it('should return correct values if getListedPanelPluginIds throws', async () => {
    getListedPanelPluginIdsMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useListedPanelPluginIds());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginInstalled', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    isPanelPluginInstalledMock.mockImplementation(actualPanels.isPanelPluginInstalled);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => usePanelPluginInstalled('timeseries'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => usePanelPluginInstalled('timeseries'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(true);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => usePanelPluginInstalled('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(false);
  });

  it('should return correct values if isPanelPluginInstalled throws', async () => {
    isPanelPluginInstalledMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => usePanelPluginInstalled('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginVersion', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    jest.resetAllMocks();
    getPanelPluginVersionMock.mockImplementation(actualPanels.getPanelPluginVersion);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => usePanelPluginVersion('timeseries'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => usePanelPluginVersion('timeseries'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual('');
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => usePanelPluginVersion('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if getAppPluginVersion throws', async () => {
    getPanelPluginVersionMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => usePanelPluginVersion('otherorg-otherplugin-panel'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});
