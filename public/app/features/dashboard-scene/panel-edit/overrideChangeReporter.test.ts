import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../utils/interactions';

import { createOverrideChangeReporter } from './overrideChangeReporter';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function setup() {
  const panel = new VizPanel({ key: 'panel-5', pluginId: 'timeseries' });
  new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  return createOverrideChangeReporter(panel);
}

const fromPanel = { source: 'edit_pane', panel_type: 'timeseries', panel_id: 5 };

describe('createOverrideChangeReporter', () => {
  let panelSettingChanged: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    panelSettingChanged.mockRestore();
  });

  it('reports adding and removing straight away', () => {
    const reporter = setup();

    reporter.report({ item: 'add_override', overrideIndex: 0, matcherId: 'byName' });
    reporter.report({ item: 'remove_override_property', overrideIndex: 0, matcherId: 'byName', propertyId: 'min' });

    expect(panelSettingChanged.mock.calls).toEqual([
      [{ item: 'add_override', matcher_id: 'byName', ...fromPanel }],
      [{ item: 'remove_override_property', matcher_id: 'byName', property_id: 'min', ...fromPanel }],
    ]);
  });

  it('reports a run of edits to the same property once, after a second', () => {
    const reporter = setup();
    const edit = {
      item: 'change_override_property',
      overrideIndex: 0,
      matcherId: 'byName',
      propertyId: 'min',
    } as const;

    reporter.report(edit);
    jest.advanceTimersByTime(500);
    reporter.report(edit);
    expect(panelSettingChanged).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);

    expect(panelSettingChanged).toHaveBeenCalledTimes(1);
    expect(panelSettingChanged).toHaveBeenCalledWith({
      item: 'change_override_property',
      matcher_id: 'byName',
      property_id: 'min',
      ...fromPanel,
    });
  });

  it('reports edits to different properties separately', () => {
    const reporter = setup();

    reporter.report({ item: 'change_override_property', overrideIndex: 0, matcherId: 'byName', propertyId: 'min' });
    reporter.report({ item: 'change_override_property', overrideIndex: 0, matcherId: 'byName', propertyId: 'max' });
    jest.advanceTimersByTime(1000);

    expect(panelSettingChanged).toHaveBeenCalledTimes(2);
  });

  it('sends pending edits when flushed', () => {
    const reporter = setup();

    reporter.report({ item: 'change_override_matcher', overrideIndex: 1, matcherId: 'byRegexp' });
    reporter.flush();

    expect(panelSettingChanged).toHaveBeenCalledWith({
      item: 'change_override_matcher',
      matcher_id: 'byRegexp',
      ...fromPanel,
    });
  });
});
