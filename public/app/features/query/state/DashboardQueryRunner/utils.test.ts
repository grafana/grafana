import { AnnotationEvent, AnnotationQuery } from '@grafana/data';

import { translateQueryResult } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    theme2: {
      visualization: {
        getColorByName: (color: string) => color ?? 'default-color',
      },
    },
  },
}));

describe('translateQueryResult', () => {
  const annotation: AnnotationQuery = {
    name: 'Test',
    enable: true,
    iconColor: 'purple',
    datasource: { uid: 'test', type: 'test' },
  };

  it('should use iconColor as fallback when event has no color and no newState', () => {
    const results: AnnotationEvent[] = [{ time: 1 }];
    const translated = translateQueryResult(annotation, results);
    expect(translated[0].color).toBe('purple');
  });

  it('should prefer iconColor over event-level color from datasource', () => {
    const results: AnnotationEvent[] = [{ time: 1, color: 'blue' }];
    const translated = translateQueryResult(annotation, results);
    expect(translated[0].color).toBe('purple');
  });

  it('should use event-level color from datasource when no iconColor is set', () => {
    const noIconColor: AnnotationQuery = { ...annotation, iconColor: '' };
    const results: AnnotationEvent[] = [{ time: 1, color: 'blue' }];
    const translated = translateQueryResult(noIconColor, results);
    expect(translated[0].color).toBe('blue');
  });

  it('should override event color with newState color when newState is set', () => {
    const results: AnnotationEvent[] = [{ time: 1, color: 'blue', newState: 'alerting' }];
    const translated = translateQueryResult(annotation, results);
    expect(translated[0].color).toBe('red');
  });

  it.each([
    ['pending', 'yellow'],
    ['alerting', 'red'],
    ['ok', 'green'],
    ['normal', 'green'],
    ['no_data', 'gray'],
    ['nodata', 'gray'],
  ])('should map newState "%s" to color "%s"', (newState, expectedColor) => {
    const results: AnnotationEvent[] = [{ time: 1, newState }];
    const translated = translateQueryResult(annotation, results);
    expect(translated[0].color).toBe(expectedColor);
  });

  it('should set source, type, and isRegion correctly', () => {
    const results: AnnotationEvent[] = [{ time: 1, timeEnd: 2 }];
    const translated = translateQueryResult(annotation, results);
    expect(translated[0].source).toBe(annotation);
    expect(translated[0].type).toBe('Test');
    expect(translated[0].isRegion).toBe(true);
  });
});
