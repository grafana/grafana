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
  useListedPanelPluginMetas,
  usePanelPluginMeta,
  usePanelPluginMetas,
  usePanelPluginInstalled,
  usePanelPluginVersion,
  usePanelPluginMetasMap,
} from './hooks';
import {
  getListedPanelPluginIds,
  getListedPanelPluginMetas,
  getPanelPluginMeta,
  getPanelPluginMetas,
  getPanelPluginMetasMap,
  getPanelPluginVersion,
  isPanelPluginInstalled,
  setPanelPluginMetas,
} from './panels';
import { apps } from './test-fixtures/config.apps';
import { panels } from './test-fixtures/config.panels';

const actualApps = await vi.importActual<typeof import('./apps')>('./apps');
const actualPanels = await vi.importActual<typeof import('./panels')>('./panels');
vi.mock('./apps', async (importOriginal) => ({
  ...(await importOriginal()),
  getAppPluginMetas: vi.fn(),
  getAppPluginMeta: vi.fn(),
  isAppPluginInstalled: vi.fn(),
  getAppPluginVersion: vi.fn(),
}));
vi.mock('./panels', async (importOriginal) => ({
  ...(await importOriginal()),
  getListedPanelPluginIds: vi.fn(),
  getListedPanelPluginMetas: vi.fn(),
  getPanelPluginMeta: vi.fn(),
  getPanelPluginMetas: vi.fn(),
  getPanelPluginMetasMap: vi.fn(),
  isPanelPluginInstalled: vi.fn(),
  getPanelPluginVersion: vi.fn(),
}));
const getAppPluginMetaMock = vi.mocked(getAppPluginMeta);
const getAppPluginMetasMock = vi.mocked(getAppPluginMetas);
const isAppPluginInstalledMock = vi.mocked(isAppPluginInstalled);
const getAppPluginVersionMock = vi.mocked(getAppPluginVersion);
const getPanelPluginMetaMock = vi.mocked(getPanelPluginMeta);
const getPanelPluginMetasMock = vi.mocked(getPanelPluginMetas);
const getPanelPluginMetasMapMock = vi.mocked(getPanelPluginMetasMap);
const isPanelPluginInstalledMock = vi.mocked(isPanelPluginInstalled);
const getPanelPluginVersionMock = vi.mocked(getPanelPluginVersion);
const getListedPanelPluginIdsMock = vi.mocked(getListedPanelPluginIds);
const getListedPanelPluginMetasMock = vi.mocked(getListedPanelPluginMetas);

describe('useAppPluginMeta', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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

describe('useListedPanelPluginMetas', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    vi.resetAllMocks();
    getListedPanelPluginMetasMock.mockImplementation(actualPanels.getListedPanelPluginMetas);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useListedPanelPluginMetas());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useListedPanelPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(
      Object.values(panels)
        .filter((p) => p.hideFromList === false)
        .sort((a, b) => a.sort - b.sort)
    );
  });

  it('should return correct values if useListedPanelPluginMetas throws', async () => {
    getListedPanelPluginMetasMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useListedPanelPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('usePanelPluginMetasMap', () => {
  beforeEach(() => {
    setPanelPluginMetas(panels);
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
    vi.resetAllMocks();
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
