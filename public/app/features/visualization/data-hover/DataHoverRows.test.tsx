import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FeatureLike } from 'ol/Feature';

import { createDataFrame, FieldType } from '@grafana/data';

import { type GeomapLayerHover } from 'app/plugins/panel/geomap/event';
import { type MapLayerState } from 'app/plugins/panel/geomap/types';

import { DataHoverRows, generateLabel } from './DataHoverRows';

jest.mock('app/plugins/panel/status-history/utils', () => ({
  getDataLinks: jest.fn().mockReturnValue([]),
}));

function makeFeature(opts: {
  id?: string | number;
  properties?: Record<string, unknown>;
  frame?: ReturnType<typeof createDataFrame>;
  rowIndex?: number;
}): FeatureLike {
  return {
    getId: () => opts.id,
    getGeometry: () => undefined,
    getProperties: () => ({ ...(opts.properties ?? {}), ...(opts.frame ? { frame: opts.frame, rowIndex: opts.rowIndex ?? 0 } : {}) }),
    get: (key: string) => {
      if (key === 'frame') return opts.frame;
      if (key === 'rowIndex') return opts.rowIndex ?? 0;
      return (opts.properties ?? {})[key];
    },
  } as unknown as FeatureLike;
}

function makeLayer(name: string, features: FeatureLike[]): GeomapLayerHover {
  return {
    layer: { getName: () => name } as MapLayerState,
    features,
  };
}

describe('generateLabel', () => {
  it('returns the "Name" property when present', () => {
    const feature = makeFeature({ properties: { Name: 'Berlin' } });
    expect(generateLabel(feature, 0)).toBe('Berlin');
  });

  it('returns the "name" property when present', () => {
    const feature = makeFeature({ properties: { name: 'Paris' } });
    expect(generateLabel(feature, 0)).toBe('Paris');
  });

  it('returns the "Title" property when present', () => {
    const feature = makeFeature({ properties: { Title: 'Capital' } });
    expect(generateLabel(feature, 0)).toBe('Capital');
  });

  it('returns the "ID" property when present', () => {
    const feature = makeFeature({ properties: { ID: 'abc-123' } });
    expect(generateLabel(feature, 0)).toBe('abc-123');
  });

  it('returns the "id" property when present', () => {
    const feature = makeFeature({ properties: { id: 'xyz' } });
    expect(generateLabel(feature, 0)).toBe('xyz');
  });

  it('returns key:value for the first string field from a frame', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'label', type: FieldType.string, values: ['Amsterdam'] },
        { name: 'count', type: FieldType.number, values: [5] },
      ],
    });
    const feature = makeFeature({ frame, rowIndex: 0 });
    const result = generateLabel(feature, 0);
    expect(result).not.toBe('Match: 1');
  });

  it('falls back to key:value for the first string property', () => {
    const feature = makeFeature({ properties: { description: 'A city' } });
    const label = generateLabel(feature, 0);
    expect(label).not.toBe('Match: 1');
  });

  it('falls back to "Match: N+1" when no string properties exist', () => {
    const feature = makeFeature({ properties: { count: 42 } });
    expect(generateLabel(feature, 2)).toBe('Match: 3');
  });

  it('uses frame string fields over plain properties for name resolution', () => {
    const frame = createDataFrame({
      fields: [{ name: 'name', type: FieldType.string, values: ['FromFrame'] }],
    });
    const feature = makeFeature({ frame, rowIndex: 0, properties: {} });
    expect(generateLabel(feature, 0)).toBe('FromFrame');
  });
});

describe('DataHoverRows', () => {
  it('renders the content for the active tab only', () => {
    const frameA = createDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['Tokyo'] }] });
    const frameB = createDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['Oslo'] }] });
    const layers = [
      makeLayer('Layer A', [makeFeature({ frame: frameA, rowIndex: 0 })]),
      makeLayer('Layer B', [makeFeature({ frame: frameB, rowIndex: 0 })]),
    ];

    render(<DataHoverRows layers={layers} activeTabIndex={0} />);
    expect(screen.getByText('Tokyo')).toBeInTheDocument();
    expect(screen.queryByText('Oslo')).not.toBeInTheDocument();
  });

  it('renders the second layer when activeTabIndex is 1', () => {
    const frameA = createDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['Tokyo'] }] });
    const frameB = createDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['Oslo'] }] });
    const layers = [
      makeLayer('Layer A', [makeFeature({ frame: frameA, rowIndex: 0 })]),
      makeLayer('Layer B', [makeFeature({ frame: frameB, rowIndex: 0 })]),
    ];

    render(<DataHoverRows layers={layers} activeTabIndex={1} />);
    expect(screen.queryByText('Tokyo')).not.toBeInTheDocument();
    expect(screen.getByText('Oslo')).toBeInTheDocument();
  });

  it('renders a single feature directly without a Collapse', () => {
    const frame = createDataFrame({ fields: [{ name: 'place', type: FieldType.string, values: ['Cairo'] }] });
    const layers = [makeLayer('Layer A', [makeFeature({ frame, rowIndex: 0 })])];

    render(<DataHoverRows layers={layers} activeTabIndex={0} />);
    expect(screen.getByText('Cairo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /match/i })).not.toBeInTheDocument();
  });

  it('wraps each feature in a Collapse when there are multiple features', () => {
    const frame = createDataFrame({ fields: [{ name: 'place', type: FieldType.string, values: ['Cairo', 'Lima'] }] });
    const featureA = makeFeature({ id: 'a', frame, rowIndex: 0 });
    const featureB = makeFeature({ id: 'b', frame, rowIndex: 1 });
    const layers = [makeLayer('Layer A', [featureA, featureB])];

    render(<DataHoverRows layers={layers} activeTabIndex={0} />);
    const toggles = screen.getAllByRole('button');
    expect(toggles.length).toBeGreaterThanOrEqual(2);
  });

  it('expands a collapsed feature on toggle click', async () => {
    const frame = createDataFrame({ fields: [{ name: 'label', type: FieldType.string, values: ['Alpha', 'Beta'] }] });
    const featureA = makeFeature({ id: 'a', properties: { name: 'Feature A' }, frame, rowIndex: 0 });
    const featureB = makeFeature({ id: 'b', properties: { name: 'Feature B' }, frame, rowIndex: 1 });
    const layers = [makeLayer('Layer A', [featureA, featureB])];

    render(<DataHoverRows layers={layers} activeTabIndex={0} />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});
