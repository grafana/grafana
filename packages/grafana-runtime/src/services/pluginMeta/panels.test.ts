import { evaluateBooleanFlag } from '../../internal/openFeature';

import { getListedPanelPluginIds, getPanelPluginMeta, getPanelPluginMetas, setPanelPluginMetas } from './panels';
import { initPluginMetas } from './plugins';
import { panel } from './test-fixtures/config.panels';

jest.mock('./plugins', () => ({ ...jest.requireActual('./plugins'), initPluginMetas: jest.fn() }));
jest.mock('../../internal/openFeature', () => ({
  ...jest.requireActual('../../internal/openFeature'),
  evaluateBooleanFlag: jest.fn(),
}));

const initPluginMetasMock = jest.mocked(initPluginMetas);
const evaluateBooleanFlagMock = jest.mocked(evaluateBooleanFlag);

describe('when useMTPlugins flag is enabled and panels is not initialized', () => {
  beforeEach(() => {
    setPanelPluginMetas({});
    jest.resetAllMocks();
    initPluginMetasMock.mockResolvedValue({ items: [] });
    evaluateBooleanFlagMock.mockReturnValue(true);
  });

  it('getPanelPluginMetas should call initPluginMetas and return correct result', async () => {
    const panels = await getPanelPluginMetas();

    expect(panels).toEqual([]);
    expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
  });

  it('getPanelPluginMeta should call initPluginMetas and return correct result', async () => {
    const result = await getPanelPluginMeta('grafana-test-panel');

    expect(result).toEqual(null);
    expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
  });

  it('getListedPanelPluginIds should call initPluginMetas and return an empty array', async () => {
    const installed = await getListedPanelPluginIds();

    expect(installed).toEqual([]);
    expect(initPluginMetasMock).toHaveBeenCalledTimes(1);
  });
});

describe('when useMTPlugins flag is enabled and panels is initialized', () => {
  beforeEach(() => {
    setPanelPluginMetas({ 'grafana-test-panel': panel });
    jest.resetAllMocks();
    evaluateBooleanFlagMock.mockReturnValue(true);
  });

  it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
    const panels = await getPanelPluginMetas();

    expect(panels).toEqual([panel]);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
    const result = await getPanelPluginMeta('grafana-test-panel');

    expect(result).toEqual(panel);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getPanelPluginMeta should return null if the pluginId is not found', async () => {
    const result = await getPanelPluginMeta('otherorg-otherplugin-panel');

    expect(result).toEqual(null);
  });

  it('getListedPanelPluginIds should not call initPluginMetas and return correct pluginIds', async () => {
    const installed = await getListedPanelPluginIds();

    expect(installed).toEqual(['grafana-test-panel']);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });
});

describe('when useMTPlugins flag is disabled and panels is not initialized', () => {
  beforeEach(() => {
    setPanelPluginMetas({});
    jest.resetAllMocks();
    evaluateBooleanFlagMock.mockReturnValue(false);
  });

  it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
    const panels = await getPanelPluginMetas();

    expect(panels).toEqual([]);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
    const result = await getPanelPluginMeta('grafana-test-panel');

    expect(result).toEqual(null);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getListedPanelPluginIds should not call initPluginMetas and return an empty array', async () => {
    const result = await getListedPanelPluginIds();

    expect(result).toEqual([]);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });
});

describe('when useMTPlugins flag is disabled and panels is initialized', () => {
  beforeEach(() => {
    setPanelPluginMetas({ 'grafana-test-panel': panel });
    jest.resetAllMocks();
    evaluateBooleanFlagMock.mockReturnValue(false);
  });

  it('getPanelPluginMetas should not call initPluginMetas and return correct result', async () => {
    const panels = await getPanelPluginMetas();

    expect(panels).toEqual([panel]);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getPanelPluginMeta should not call initPluginMetas and return correct result', async () => {
    const result = await getPanelPluginMeta('grafana-test-panel');

    expect(result).toEqual(panel);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });

  it('getPanelPluginMeta should return null if the pluginId is not found', async () => {
    const result = await getPanelPluginMeta('otherorg-otherplugin-panel');

    expect(result).toEqual(null);
  });

  it('getListedPanelPluginIds should not call initPluginMetas and return correct pluginIds', async () => {
    const result = await getListedPanelPluginIds();

    expect(result).toEqual(['grafana-test-panel']);
    expect(initPluginMetasMock).not.toHaveBeenCalled();
  });
});

describe('immutability', () => {
  beforeEach(() => {
    setPanelPluginMetas({ 'grafana-test-panel': panel });
    jest.resetAllMocks();
    evaluateBooleanFlagMock.mockReturnValue(false);
  });

  it('getPanelPluginMetas should return a deep clone', async () => {
    const mutatedPanels = await getPanelPluginMetas();

    // assert we have correct props
    expect(mutatedPanels).toHaveLength(1);
    expect(mutatedPanels[0].info.author.name).toEqual('Grafana');
    expect(mutatedPanels[0].info.links).toHaveLength(0);

    // mutate deep props
    mutatedPanels[0].info.author.name = '';
    mutatedPanels[0].info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedPanels[0].info.author.name).toEqual('');
    expect(mutatedPanels[0].info.links).toHaveLength(1);
    expect(mutatedPanels[0].info.links[0]).toEqual({ name: '', url: '' });

    const panels = await getPanelPluginMetas();

    // assert that we have not mutated the source
    expect(panels[0].info.author.name).toEqual('Grafana');
    expect(panels[0].info.links).toHaveLength(0);
  });

  it('getPanelPluginMeta should return a deep clone', async () => {
    const mutatedApp = await getPanelPluginMeta('grafana-test-panel');

    // assert we have correct props
    expect(mutatedApp).toBeDefined();
    expect(mutatedApp!.info.author.name).toEqual('Grafana');
    expect(mutatedApp!.info.links).toHaveLength(0);

    // mutate deep props
    mutatedApp!.info.author.name = '';
    mutatedApp!.info.links.push({ name: '', url: '' });

    // assert we have mutated props
    expect(mutatedApp!.info.author.name).toEqual('');
    expect(mutatedApp!.info.links).toHaveLength(1);
    expect(mutatedApp!.info.links[0]).toEqual({ name: '', url: '' });

    const result = await getPanelPluginMeta('grafana-test-panel');

    // assert that we have not mutated the source
    expect(result).toBeDefined();
    expect(result!.info.author.name).toEqual('Grafana');
    expect(result!.info.links).toHaveLength(0);
  });
});
