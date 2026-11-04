import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { getPanelLabels } from './labels';
import { attribute, type AttributionContext } from './rules';

function context(overrides: Partial<DashboardV2Spec> = {}, payloadOverrides: Partial<DashboardV2Spec> = {}) {
  const baseline = { ...defaultSpec(), ...overrides };
  const ctx: AttributionContext = {
    baseline,
    payload: { ...baseline, ...payloadOverrides },
    panelLabels: () => getPanelLabels(undefined, {}, {}),
    pluginName: () => undefined,
  };
  return ctx;
}

const where = (path: string, ctx = context()) => {
  const target = attribute(path.split('/'), ctx);
  return {
    owner: target.owner.kind === 'panel' ? `panel:${target.owner.element}` : 'dashboard',
    category: target.category,
    key: target.key,
    label: target.describe.type === 'value' ? target.describe.label : target.describe.type,
  };
};

describe('attribute', () => {
  it.each([
    ['title', 'properties', 'title', 'Title'],
    ['description', 'properties', 'description', 'Description'],
    ['tags/1', 'properties', 'tags', 'namedList'],
    ['editable', 'properties', 'editable', 'Editable'],
    ['preload', 'properties', 'preload', 'Preload panels'],
    ['liveNow', 'properties', 'liveNow', 'Refresh live dashboards'],
    ['cursorSync', 'properties', 'cursorSync', 'Graph tooltip'],
    ['preferences/layout/kind', 'layout', 'preferences', 'defaultGrid'],
    ['variables/0/spec/label', 'controls', 'variables', 'namedList'],
    ['annotations/1/spec/enable', 'controls', 'annotations', 'namedList'],
    ['links/0', 'controls', 'links', 'namedList'],
    ['timeSettings/timezone', 'controls', 'timeSettings/timezone', 'Time zone'],
    ['timeSettings/autoRefresh', 'controls', 'timeSettings/autoRefresh', 'Auto refresh'],
    ['timeSettings/hideTimepicker', 'controls', 'timeSettings/hideTimepicker', 'Hide time picker'],
  ])('routes the dashboard path %s', (path, category, key, label) => {
    expect(where(path)).toEqual({ owner: 'dashboard', category, key, label });
  });

  it('reads from and to as one default time range', () => {
    expect(where('timeSettings/from').key).toBe('timeSettings/range');
    expect(where('timeSettings/to').key).toBe('timeSettings/range');
  });

  it.each([
    ['spec/title', 'properties', 'Title'],
    ['spec/description', 'properties', 'Description'],
    ['spec/subtitle', 'properties', 'Subtitle'],
    ['spec/transparent', 'properties', 'Transparent background'],
    ['spec/links/0/url', 'properties', 'namedList'],
    ['spec/libraryPanel/name', 'properties', 'Library panel'],
    ['spec/data/spec/queries/0/spec/refId', 'data', 'namedList'],
    ['spec/data/spec/transformations/1', 'data', 'namedList'],
    ['spec/data/spec/queryOptions/maxDataPoints', 'data', 'Max data points'],
    ['spec/data/spec/queryOptions/interval', 'data', 'Min interval'],
    ['spec/data/spec/queryOptions/somethingNew', 'data', 'Something new'],
    ['spec/vizConfig/group', 'visualization', 'Visualization'],
    ['spec/vizConfig/version', 'visualization', 'Plugin version'],
    ['spec/vizConfig/spec/options/legend/displayMode', 'pluginOptions', 'Legend › Display mode'],
    ['spec/vizConfig/spec/fieldConfig/defaults/custom/lineWidth', 'fieldConfig', 'Line width'],
    ['spec/vizConfig/spec/fieldConfig/overrides/0/properties/0/value', 'fieldConfig', 'namedList'],
  ])('routes the panel path %s', (path, category, label) => {
    expect(where(`elements/panel-1/${path}`)).toMatchObject({ owner: 'panel:panel-1', category, label });
  });

  it('never shows array indexes: a change inside an array is a change of the array', () => {
    expect(where('elements/panel-1/spec/vizConfig/spec/options/reduceOptions/calcs/0')).toMatchObject({
      key: 'elements/panel-1/spec/vizConfig/spec/options/reduceOptions/calcs',
      label: 'Reduce options › Calcs',
    });
  });

  it('sends unknown paths to Other on the nearest node, humanized', () => {
    expect(where('somethingNew/deep')).toEqual({
      owner: 'dashboard',
      category: 'other',
      key: 'somethingNew/deep',
      label: 'Something new › Deep',
    });
    expect(where('elements/panel-1/spec/futureField')).toMatchObject({
      owner: 'panel:panel-1',
      category: 'other',
      label: 'Future field',
    });
  });

  it('folds what the old visualization had and the new one dropped into the Visualization line', () => {
    const panel = (group: string, options: Record<string, unknown>) => ({
      kind: 'Panel' as const,
      spec: {
        id: 1,
        title: 'CPU',
        links: [],
        data: { kind: 'QueryGroup' as const, spec: { queries: [], transformations: [], queryOptions: {} } },
        vizConfig: {
          kind: 'VizConfig' as const,
          group,
          version: '',
          spec: { options, fieldConfig: { defaults: {}, overrides: [] } },
        },
      },
    });
    const ctx = context(
      { elements: { 'panel-1': panel('timeseries', { legend: { displayMode: 'list' } }) } },
      { elements: { 'panel-1': panel('stat', { colorMode: 'background' }) } }
    );

    expect(where('elements/panel-1/spec/vizConfig/spec/options/legend', ctx)).toMatchObject({
      category: 'visualization',
      key: 'elements/panel-1/spec/vizConfig/group',
      label: 'Visualization',
    });
    expect(where('elements/panel-1/spec/vizConfig/version', ctx).key).toBe('elements/panel-1/spec/vizConfig/group');
    expect(where('elements/panel-1/spec/vizConfig/spec/options/colorMode', ctx)).toMatchObject({
      category: 'pluginOptions',
      label: 'Color mode',
    });
  });

  it('keeps the rule table order for fields of a category', () => {
    const order = (path: string) => attribute(path.split('/'), context()).order;

    expect(order('title')).toBeLessThan(order('description'));
    expect(order('variables/0')).toBeLessThan(order('annotations/0'));
    expect(order('links/0')).toBeLessThan(order('timeSettings/timezone'));
    expect(order('elements/p/spec/data/spec/queries/0')).toBeLessThan(
      order('elements/p/spec/data/spec/transformations/0')
    );
  });
});
