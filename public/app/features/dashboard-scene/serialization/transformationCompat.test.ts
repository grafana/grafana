import { defaultSpec, type TransformationKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type TransformationKind as V2Beta1TransformationKind } from '@grafana/schema/apis/dashboard.grafana.app/v2beta1';

import { normalizeTransformation, toWireTransformation, convertSpecToWireFormat } from './transformationCompat';

const v2: TransformationKind = {
  kind: 'Transformation',
  group: 'limit',
  spec: { disabled: false, filter: { id: 'byValue', options: { reducer: 'sum' } }, options: { limit: 10 } },
};

const v2beta1: V2Beta1TransformationKind = {
  kind: 'limit',
  spec: {
    id: 'limit',
    disabled: false,
    filter: { id: 'byValue', options: { reducer: 'sum' } },
    options: { limit: 10 },
  },
};

describe('normalizeTransformation', () => {
  it('passes through v2 stable', () => {
    expect(normalizeTransformation(v2)).toEqual(v2);
  });

  it('converts v2beta1 to v2 stable', () => {
    expect(normalizeTransformation(v2beta1)).toEqual(v2);
  });

  it('handles minimal v2beta1 (no filter/topic)', () => {
    expect(normalizeTransformation({ kind: 'organize', spec: { id: 'organize', options: {} } })).toEqual({
      kind: 'Transformation',
      group: 'organize',
      spec: { options: {} },
    });
  });
});

describe('toWireTransformation', () => {
  it('passes through for v2', () => {
    expect(toWireTransformation(v2, 'v2')).toEqual(v2);
  });

  it('converts to v2beta1 wire format', () => {
    expect(toWireTransformation(v2, 'v2beta1')).toEqual(v2beta1);
  });
});

describe('roundtrip', () => {
  it('v2 -> v2beta1 wire -> normalize', () => {
    expect(normalizeTransformation(toWireTransformation(v2, 'v2beta1'))).toEqual(v2);
  });

  it('v2beta1 -> normalize -> v2beta1 wire', () => {
    expect(toWireTransformation(normalizeTransformation(v2beta1), 'v2beta1')).toEqual(v2beta1);
  });
});

describe('convertSpecToWireFormat', () => {
  const specWithPanel = (transformations: TransformationKind[]) => ({
    ...defaultSpec(),
    elements: {
      p1: {
        kind: 'Panel' as const,
        spec: {
          id: 1,
          title: 'T',
          description: '',
          links: [],
          data: { kind: 'QueryGroup' as const, spec: { queries: [], transformations, queryOptions: {} } },
          vizConfig: {
            kind: 'VizConfig' as const,
            group: 'timeseries',
            version: '1',
            spec: { fieldConfig: { defaults: {}, overrides: [] }, options: {} },
          },
        },
      },
    },
  });

  it('returns same reference for v2 (no-op)', () => {
    const spec = specWithPanel([v2]);
    expect(convertSpecToWireFormat(spec, 'v2')).toBe(spec);
  });

  it('converts transformations for v2beta1', () => {
    const result = convertSpecToWireFormat(specWithPanel([v2]), 'v2beta1');
    const panel = result.elements['p1'];
    if (panel.kind !== 'Panel') {
      throw new Error('expected Panel');
    }
    expect(panel.spec.data.spec.transformations[0].kind).toBe('limit');
  });

  it('skips panels without transformations', () => {
    const spec = specWithPanel([]);
    expect(convertSpecToWireFormat(spec, 'v2beta1').elements['p1']).toBe(spec.elements['p1']);
  });

  it('handles already-v2beta1 transformations when targeting v2beta1 (restore path)', () => {
    // Simulate restoreDashboardVersion: spec fetched via v2beta1 endpoint already has v2beta1 shape
    const v2beta1Spec = specWithPanel([v2beta1 as unknown as TransformationKind]);
    const result = convertSpecToWireFormat(v2beta1Spec, 'v2beta1');
    const panel = result.elements['p1'];
    if (panel.kind !== 'Panel') {
      throw new Error('expected Panel');
    }
    // Should produce valid v2beta1, not corrupt the payload
    expect(panel.spec.data.spec.transformations[0].kind).toBe('limit');
    expect((panel.spec.data.spec.transformations[0] as unknown as V2Beta1TransformationKind).spec.id).toBe('limit');
  });
});
