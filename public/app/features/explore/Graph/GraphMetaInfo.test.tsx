import { render, screen } from '@testing-library/react';

import { toDataFrame, FieldType } from '@grafana/data';

import { GraphMetaInfo } from './GraphMetaInfo';

function graphFrame(refId: string, queryType?: 'Exemplar' | 'Instant' | 'Range', samples?: number) {
  return toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [1] },
    ],
    meta:
      queryType === undefined || samples === undefined
        ? undefined
        : { stats: [{ displayName: `${queryType}: Equivalent samples read`, unit: 'short', value: samples }] },
  });
}

describe('GraphMetaInfo', () => {
  it('renders the formatted equivalent samples read stat', () => {
    render(<GraphMetaInfo data={[graphFrame('A', 'Range', 17647)]} />);

    expect(screen.getByText('Equivalent samples read:')).toBeInTheDocument();
    expect(screen.getByText('17.6 K')).toBeInTheDocument();
  });

  it('sums the stat across duplicate frames for the same query, deduping by refId and query type', () => {
    render(
      <GraphMetaInfo
        data={[graphFrame('A', 'Range', 1000), graphFrame('A', 'Range', 1000), graphFrame('B', 'Range', 1000)]}
      />
    );

    expect(screen.getByText('2 K')).toBeInTheDocument();
  });

  it('sums the stat across query types for the same refId', () => {
    render(<GraphMetaInfo data={[graphFrame('A', 'Range', 1000), graphFrame('A', 'Instant', 500)]} />);

    expect(screen.getByText('1.50 K')).toBeInTheDocument();
  });

  it('ignores an exemplar-tagged stat', () => {
    render(<GraphMetaInfo data={[graphFrame('A', 'Range', 1000), graphFrame('A', 'Exemplar', 500)]} />);

    expect(screen.getByText('1 K')).toBeInTheDocument();
  });

  it('renders nothing when no frame carries the stat', () => {
    const { container } = render(<GraphMetaInfo data={[graphFrame('A')]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
