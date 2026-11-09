import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { plugin as timeseries } from 'app/plugins/panel/timeseries/module';

import { type Diff } from '../../../settings/version-history/utils';

import { emptyBaselineFor } from './paths';
import { isSystemDefault, type DefaultsContext } from './systemDefaults';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

function withPanel(options: Record<string, unknown>, version = '11.0.0'): DashboardV2Spec {
  return {
    ...defaultSpec(),
    elements: {
      'panel-1': {
        kind: 'Panel',
        spec: {
          id: 1,
          title: 'CPU',
          links: [],
          data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version,
            spec: { options, fieldConfig: { defaults: {}, overrides: [] } },
          },
        },
      },
    },
  };
}

const diff = (op: Diff['op'], path: string, value: unknown, originalValue?: unknown): Diff => ({
  op,
  path: path.split('/'),
  value,
  originalValue,
  startLineNumber: 0,
  endLineNumber: 0,
});

const OPTIONS = 'elements/panel-1/spec/vizConfig/spec/options';

describe('isSystemDefault', () => {
  const baseline = withPanel({ tooltip: { mode: 'single' } }, '');
  const payload = withPanel({ tooltip: { mode: 'single', sort: 'none' } });
  const loaded: DefaultsContext = { baseline, payload, getPlugin: () => timeseries };
  const notLoaded: DefaultsContext = { baseline, payload, getPlugin: () => undefined };

  it('accepts a plugin option default the baseline lacks, when the plugin is loaded', () => {
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/sort`, 'none'), loaded)).toBe(true);
  });

  it('treats the same add as a user change while the plugin is not loaded', () => {
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/sort`, 'none'), notLoaded)).toBe(false);
  });

  it('treats a value other than the default as a user change', () => {
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/sort`, 'desc'), loaded)).toBe(false);
  });

  it('treats a value changed to the default as a user change', () => {
    expect(isSystemDefault(diff('replace', `${OPTIONS}/tooltip/mode`, 'single', 'multi'), loaded)).toBe(false);
  });

  it('accepts an empty value only where the serializer always writes it', () => {
    expect(isSystemDefault(diff('add', 'elements/panel-1/spec/description', ''), notLoaded)).toBe(true);
    expect(isSystemDefault(diff('add', 'elements/panel-1/spec/subtitle', ''), notLoaded)).toBe(false);
  });

  it('accepts an added false for a key the baseline lacks, plugin or not', () => {
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/hideZeros`, false), loaded)).toBe(true);
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/hideZeros`, false), notLoaded)).toBe(true);
    expect(isSystemDefault(diff('add', `${OPTIONS}/tooltip/hideZeros`, true), notLoaded)).toBe(false);
  });

  it('accepts every plugin version change: filled in or bumped', () => {
    expect(isSystemDefault(diff('replace', 'elements/panel-1/spec/vizConfig/version', '11.0.0', ''), notLoaded)).toBe(
      true
    );
    const versioned = { ...notLoaded, baseline: withPanel({}, '10.4.0') };
    expect(
      isSystemDefault(diff('replace', 'elements/panel-1/spec/vizConfig/version', '11.0.0', '10.4.0'), versioned)
    ).toBe(true);
  });

  it('compares the thresholds base step as the serializer writes it: −∞ as 0', () => {
    const path = 'elements/panel-1/spec/vizConfig/spec/fieldConfig/defaults/thresholds';
    const thresholds = {
      mode: 'absolute',
      steps: [
        { color: 'green', value: 0 },
        { color: 'red', value: 80 },
      ],
    };

    expect(isSystemDefault(diff('add', path, thresholds), loaded)).toBe(true);
    expect(isSystemDefault(diff('add', `${path}/steps/0/value`, 0), loaded)).toBe(true);
    expect(isSystemDefault(diff('add', `${path}/steps/0/value`, 10), loaded)).toBe(false);
  });

  it('accepts schema defaults of the dashboard', () => {
    const { timezone, ...withoutTimezone } = defaultSpec().timeSettings;
    const ctx: DefaultsContext = {
      baseline: { ...defaultSpec(), timeSettings: withoutTimezone },
      payload: defaultSpec(),
    };

    expect(isSystemDefault(diff('add', 'timeSettings/timezone', 'browser'), ctx)).toBe(true);
    expect(isSystemDefault(diff('add', 'timeSettings/timezone', 'utc'), ctx)).toBe(false);
  });
});

describe('emptyBaselineFor', () => {
  it('writes an empty auto grid as the serializer does, leaving out settings at their default', () => {
    const payload: DashboardV2Spec = {
      ...defaultSpec(),
      layout: { kind: 'AutoGridLayout', spec: { columnWidthMode: 'wide', rowHeightMode: 'tall', items: [] } },
    };

    expect(emptyBaselineFor(payload).layout).toEqual({
      kind: 'AutoGridLayout',
      spec: { maxColumnCount: 3, columnWidthMode: 'standard', rowHeightMode: 'standard', items: [] },
    });
  });

  it('keeps the schema defaults, empties the content and matches the root layout kind', () => {
    const payload: DashboardV2Spec = {
      ...defaultSpec(),
      title: 'New',
      tags: ['a'],
      layout: { kind: 'TabsLayout', spec: { tabs: [] } },
    };

    expect(emptyBaselineFor(payload)).toEqual({
      ...defaultSpec(),
      title: '',
      tags: [],
      layout: { kind: 'TabsLayout', spec: { tabs: [] } },
    });
  });
});
