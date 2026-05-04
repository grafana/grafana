import { render, screen } from '@testing-library/react';
import { type FeatureLike } from 'ol/Feature';

import { ArrayDataFrame, createDataFrame, FieldType } from '@grafana/data';

import { DataHoverRow } from './DataHoverRow';

jest.mock('app/plugins/panel/status-history/utils', () => ({
  getDataLinks: jest.fn().mockReturnValue([]),
}));

function makeFeature(opts: {
  frame?: ReturnType<typeof createDataFrame>;
  rowIndex?: number;
  properties?: Record<string, unknown>;
}): FeatureLike {
  return {
    getId: () => 'test-feature',
    getGeometry: () => undefined,
    getProperties: () => opts.properties ?? {},
    get: (key: string) => {
      if (key === 'frame') {
        return opts.frame;
      }
      if (key === 'rowIndex') {
        return opts.rowIndex ?? 0;
      }
      return undefined;
    },
  } as unknown as FeatureLike;
}

describe('DataHoverRow', () => {
  it('returns null when no feature is provided', () => {
    const { container } = render(<DataHoverRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders values from a feature with a frame', () => {
    const frame = createDataFrame({
      fields: [{ name: 'city', type: FieldType.string, values: ['Berlin'] }],
    });
    const feature = makeFeature({ frame, rowIndex: 0 });
    render(<DataHoverRow feature={feature} />);
    expect(screen.getByText('Berlin')).toBeInTheDocument();
  });

  it('renders values from feature properties when no frame is present', () => {
    const feature = makeFeature({ properties: { country: 'Germany', geometry: null } });
    render(<DataHoverRow feature={feature} />);
    expect(screen.getByText('Germany')).toBeInTheDocument();
  });

  it('excludes the geometry property when rendering from feature properties', () => {
    const feature = makeFeature({ properties: { name: 'Point A', geometry: { type: 'Point' } } });
    render(<DataHoverRow feature={feature} />);
    expect(screen.queryByText('geometry')).not.toBeInTheDocument();
    expect(screen.getByText('Point A')).toBeInTheDocument();
  });

  it('renders values from the correct rowIndex in the frame', () => {
    const frame = createDataFrame({
      fields: [{ name: 'label', type: FieldType.string, values: ['first', 'second', 'third'] }],
    });
    const feature = makeFeature({ frame, rowIndex: 2 });
    render(<DataHoverRow feature={feature} />);
    expect(screen.getByText('third')).toBeInTheDocument();
    expect(screen.queryByText('first')).not.toBeInTheDocument();
  });

  it('renders from ArrayDataFrame built from properties when feature has no frame', () => {
    const feature = makeFeature({ properties: { score: 99 } });
    render(<DataHoverRow feature={feature} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });
});
