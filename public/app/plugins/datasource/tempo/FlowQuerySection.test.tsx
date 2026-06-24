import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { of } from 'rxjs';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { FlowQuerySection } from './FlowQuerySection';
import { type TempoQuery } from './types';

const baseQuery: TempoQuery = { refId: 'A', queryType: 'flow', flowFilters: [], filters: [] };

// One instant-metrics series per destination, labelled and single-valued.
function facetFrame(attr: string, value: string, count: number): DataFrame {
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      { name: 'value', type: FieldType.number, values: [count], labels: { [attr]: value } },
    ],
  });
}

function makeDatasource(frames: DataFrame[]) {
  return {
    query: jest.fn().mockReturnValue(of({ data: frames })),
  } as unknown as Parameters<typeof FlowQuerySection>[0]['datasource'];
}

describe('FlowQuerySection drill-down', () => {
  it('renders facet values from a side-query and filters on click', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const ds = makeDatasource([facetFrame('span.destination.address', '1.2.3.4', 9)]);

    render(
      <FlowQuerySection datasource={ds} query={baseQuery} onChange={onChange} onRunQuery={onRunQuery} />
    );

    // Facet value appears once the side-query resolves.
    await waitFor(() => expect(screen.getByText('1.2.3.4')).toBeInTheDocument());

    fireEvent.click(screen.getByText('1.2.3.4'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        flowFilters: [{ key: 'destination', values: ['1.2.3.4'] }],
        query: '{ span.destination.address = "1.2.3.4" }',
      })
    );
    expect(onRunQuery).toHaveBeenCalled();
  });

  it('renders a table|topology toggle and updates flowView on click', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const ds = makeDatasource([]);

    await act(async () => {
      render(
        <FlowQuerySection datasource={ds} query={baseQuery} onChange={onChange} onRunQuery={onRunQuery} />
      );
    });

    // The toggle should show "Table" and "Topology" options
    const topologyButton = screen.getByRole('radio', { name: /topology/i });
    expect(topologyButton).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /table/i })).toBeInTheDocument();

    fireEvent.click(topologyButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flowView: 'topology' })
    );
    expect(onRunQuery).toHaveBeenCalled();
  });

  it('renders a chip for an active filter and removes it on click', async () => {
    const onChange = jest.fn();
    const withFilter: TempoQuery = {
      ...baseQuery,
      flowFilters: [{ key: 'direction', values: ['egress'] }],
    };
    const ds = makeDatasource([]);

    render(
      <FlowQuerySection datasource={ds} query={withFilter} onChange={onChange} onRunQuery={jest.fn()} />
    );

    // Drain the FacetPanel side-query promises inside an act boundary.
    await waitFor(() => {});

    const chip = screen.getByText(/Direction: egress/);
    expect(chip).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove filter Direction: egress'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flowFilters: [], query: '{}' })
    );
  });
});
