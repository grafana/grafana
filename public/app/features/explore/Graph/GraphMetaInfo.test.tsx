import { render, screen } from '@testing-library/react';

import { toDataFrame, FieldType } from '@grafana/data';

import { GraphMetaInfo } from './GraphMetaInfo';

function graphFrame(refId: string, samples?: number) {
  return toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'Value', type: FieldType.number, values: [1] },
    ],
    meta:
      samples === undefined
        ? undefined
        : { stats: [{ displayName: 'Equivalent samples read', unit: 'short', value: samples }] },
  });
}

describe('GraphMetaInfo', () => {
  it('renders the formatted equivalent samples read stat', () => {
    render(<GraphMetaInfo data={[graphFrame('A', 17647)]} />);

    expect(screen.getByText('Equivalent samples read:')).toBeInTheDocument();
    expect(screen.getByText('17.6 K')).toBeInTheDocument();
  });

  it('sums the stat across queries, deduping by refId', () => {
    render(<GraphMetaInfo data={[graphFrame('A', 1000), graphFrame('A', 1000), graphFrame('B', 1000)]} />);

    expect(screen.getByText('2 K')).toBeInTheDocument();
  });

  it('renders nothing when no frame carries the stat', () => {
    const { container } = render(<GraphMetaInfo data={[graphFrame('A')]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
