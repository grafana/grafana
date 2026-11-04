import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { plugin as timeseries } from 'app/plugins/panel/timeseries/module';

import {
  displayColorScheme,
  getPanelLabels,
  humanizeKey,
  humanizePath,
  isStandardTextFieldConfig,
  joinLabel,
} from './labels';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

describe('humanized labels', () => {
  it.each([
    ['showLegend', 'Show legend'],
    ['maxDataPoints', 'Max data points'],
    ['expr', 'Expr'],
    ['legendFormat', 'Legend format'],
  ])('%s → %s', (key, label) => {
    expect(humanizeKey(key)).toBe(label);
  });

  it('joins path segments with ›', () => {
    expect(humanizePath(['legend', 'displayMode'])).toBe('Legend › Display mode');
    expect(humanizePath(['tooltip', 'hideZeros'])).toBe('Tooltip › Hide zeros');
  });

  it('unescapes JSON-pointer segments for display', () => {
    expect(humanizePath(['a~1b'])).toBe('A/b');
  });

  it('does not repeat a name equal to its category', () => {
    expect(joinLabel(['Thresholds', 'Thresholds'])).toBe('Thresholds');
  });
});

describe('displayColorScheme', () => {
  it('names a color mode as the picker does, with the color of a single color', () => {
    expect(displayColorScheme({ mode: 'thresholds' })).toBe('From thresholds');
    expect(displayColorScheme({ mode: 'fixed', fixedColor: 'red' })).toBe('Single color (red)');
    expect(displayColorScheme({ mode: 'made-up' })).toBe('made-up');
  });
});

describe('getPanelLabels', () => {
  beforeAll(() => {
    timeseries.meta = { ...timeseries.meta, id: 'timeseries', name: 'Time series' };
  });

  it('labels plugin options with their editor category and name', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'displayMode'])).toMatchObject({
      path: ['legend', 'displayMode'],
      label: 'Legend › Mode',
    });
    expect(labels.option(['tooltip', 'hideZeros'])?.label).toBe('Tooltip › Hide zeros');
  });

  it('takes the longest option path that prefixes a deeper path', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'calcs', '0'])).toMatchObject({ path: ['legend', 'calcs'] });
  });

  it('names a path above several options by the category they share', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.optionGroup(['legend'])?.label).toBe('Legend');
    expect(labels.option(['legend'])).toBeUndefined();
  });

  it('labels field config with the registry category and name, standard and custom', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.fieldConfig(['unit'])?.label).toBe('Standard options › Unit');
    expect(labels.fieldConfig(['custom', 'lineWidth'])?.label).toBe('Graph styles › Line width');
    expect(labels.fieldConfig(['thresholds', 'steps', '1', 'value'])).toMatchObject({
      path: ['thresholds'],
      label: 'Thresholds',
    });
  });

  it("shows option values in the editor's words: choice labels and unit names", () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'displayMode'])?.display?.('table')).toBe('Table');
    expect(labels.option(['legend', 'displayMode'])?.display?.('unknown')).toBeUndefined();
    expect(labels.fieldConfig(['unit'])?.display?.('none')).toBe('Number');
    expect(labels.fieldConfig(['unit'])?.display?.('percent')).toBe('Percent (0-100)');
  });

  it('knows which field config values are typed into a text box', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.fieldConfig(['displayName'])?.textInput).toBe(true);
    expect(labels.fieldConfig(['custom', 'axisLabel'])?.textInput).toBe(true);
    expect(labels.fieldConfig(['unit'])?.textInput).toBe(false);
    expect(isStandardTextFieldConfig('noValue')).toBe(true);
    expect(isStandardTextFieldConfig('unit')).toBe(false);
  });

  it('knows no labels without a plugin', () => {
    const labels = getPanelLabels(undefined, {}, {});

    expect(labels.option(['legend', 'displayMode'])).toBeUndefined();
    expect(labels.optionGroup(['legend'])).toBeUndefined();
    expect(labels.fieldConfig(['unit'])).toBeUndefined();
  });
});
