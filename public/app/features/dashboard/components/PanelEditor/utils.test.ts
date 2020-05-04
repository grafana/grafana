import { FieldConfig, standardFieldConfigEditorRegistry } from '@grafana/data';
import { supportsDataQuery } from './utils';
import { PanelModel } from '../../state/PanelModel';

describe('standardFieldConfigEditorRegistry', () => {
  const dummyConfig: FieldConfig = {
    title: 'Hello',
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
      const panel = ({ plugin: { meta: { skipDataQuery: false } } } as unknown) as PanelModel;
      expect(supportsDataQuery(panel)).toBe(true);
    });
  });

  describe('when called with plugin that does not support queries', () => {
    it('then it should return false', () => {
      const panel = ({ plugin: { meta: { skipDataQuery: true } } } as unknown) as PanelModel;
      expect(supportsDataQuery(panel)).toBe(false);
    });
  });

  describe('when called without skipDataQuery', () => {
    it('then it should return false', () => {
      const panel = ({ plugin: { meta: {} } } as unknown) as PanelModel;
      expect(supportsDataQuery(panel)).toBe(false);
    });
  });

  describe('when called without plugin', () => {
    it('then it should return false', () => {
      const panel = ({} as unknown) as PanelModel;
      expect(supportsDataQuery(panel)).toBe(false);
    });
  });
});
