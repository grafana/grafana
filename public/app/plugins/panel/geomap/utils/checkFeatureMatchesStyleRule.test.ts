import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { ComparisonOperations } from '../types';
import { checkFeatureMatchesStyleRule } from './checkFeatureMatchesStyleRule';

describe('check if feature matches style rule', () => {
  it('can compare with numbers', () => {
    const rule1 = {
      operations: ComparisonOperations.EQ,
      property: 'number',
      value: 3,
    };
    const rule2 = {
      operations: ComparisonOperations.LT,
      property: 'number',
      value: 2,
    };
    const rule3 = {
      operations: ComparisonOperations.LTE,
      property: 'number',
      value: 3,
    };
    const rule4 = {
      operations: ComparisonOperations.GT,
      property: 'number',
      value: 3,
    };
    const rule5 = {
      operations: ComparisonOperations.GTE,
      property: 'number',
      value: 3,
    };

    const feature = new Feature({
      geometry: new Polygon([-5e6, 6e6], [-5e6, 8e6], [-3e6, 8e6]),
      name: 'test polygon',
    });

    feature.setProperties({ number: 3 });

    expect(checkFeatureMatchesStyleRule(rule1, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule2, feature)).toEqual(false);
    expect(checkFeatureMatchesStyleRule(rule3, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule4, feature)).toEqual(false);
    expect(checkFeatureMatchesStyleRule(rule5, feature)).toEqual(true);
  });
  it('can compare with strings', () => {
    const rule1 = {
      operations: ComparisonOperations.EQ,
      property: 'string',
      value: 'B',
    };
    const rule2 = {
      operations: ComparisonOperations.LT,
      property: 'string',
      value: 'c',
    };
    const rule3 = {
      operations: ComparisonOperations.LTE,
      property: 'string',
      value: 'bc',
    };
    const rule4 = {
      operations: ComparisonOperations.GT,
      property: 'string',
      value: 'ab',
    };
    const rule5 = {
      operations: ComparisonOperations.GTE,
      property: 'string',
      value: 'abc',
    };

    const feature = new Feature({
      geometry: new Polygon([-5e6, 6e6], [-5e6, 8e6], [-3e6, 8e6]),
      name: 'test polygon',
    });

    feature.setProperties({ string: 'b' });

    expect(checkFeatureMatchesStyleRule(rule1, feature)).toEqual(false);
    expect(checkFeatureMatchesStyleRule(rule2, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule3, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule4, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule5, feature)).toEqual(true);
  });
  it('can compare with booleans', () => {
    const rule1 = {
      operations: ComparisonOperations.EQ,
      property: 'boolean',
      value: false,
    };
    const rule2 = {
      operations: ComparisonOperations.LT,
      property: 'boolean',
      value: true,
    };
    const rule3 = {
      operations: ComparisonOperations.LTE,
      property: 'boolean',
      value: true,
    };
    const rule4 = {
      operations: ComparisonOperations.GT,
      property: 'boolean',
      value: false,
    };
    const rule5 = {
      operations: ComparisonOperations.GTE,
      property: 'boolean',
      value: false,
    };

    const feature = new Feature({
      geometry: new Polygon([-5e6, 6e6], [-5e6, 8e6], [-3e6, 8e6]),
      name: 'test polygon',
    });

    feature.setProperties({ boolean: false });

    expect(checkFeatureMatchesStyleRule(rule1, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule2, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule3, feature)).toEqual(true);
    expect(checkFeatureMatchesStyleRule(rule4, feature)).toEqual(false);
    expect(checkFeatureMatchesStyleRule(rule5, feature)).toEqual(true);
  });
});
