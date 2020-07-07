import { FieldConfig, PanelPlugin, standardFieldConfigEditorRegistry } from '@grafana/data';
import { supportsDataQuery } from './utils';

describe('standardFieldConfigEditorRegistry', () => {
  const dummyConfig: FieldConfig = {
    displayName: 'Hello',
    min: 10,
    max: 10,
    decimals: 10,
    thresholds: {} as any,
    noValue: 'no value',
    unit: 'km/s',
    links: {} as any,
  };

  it('make sure all fields have a valid name', () => {
    standardFieldConfigEditorRegistry.list().forEach(v => {
      if (!dummyConfig.hasOwnProperty(v.id)) {
        fail(`Registry uses unknown property: ${v.id}`);
      }
    });
  });
});

describe('supportsDataQuery', () => {
  describe('when called with plugin that supports queries', () => {
    it('then it should return true', () => {
      const plugin = ({ meta: { skipDataQuery: false } } as unknown) as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(true);
    });
  });

  describe('when called with plugin that does not support queries', () => {
    it('then it should return false', () => {
      const plugin = ({ meta: { skipDataQuery: true } } as unknown) as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(false);
    });
  });

  describe('when called without skipDataQuery', () => {
    it('then it should return false', () => {
      const plugin = ({ meta: {} } as unknown) as PanelPlugin;
      expect(supportsDataQuery(plugin)).toBe(false);
    });
  });

  describe('when called without plugin', () => {
    it('then it should return false', () => {
      expect(supportsDataQuery(undefined)).toBe(false);
    });
  });
});
