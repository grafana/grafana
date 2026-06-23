import { render, screen } from '@testing-library/react';

import { FlowQuerySection } from './FlowQuerySection';
import { type TempoQuery } from './types';

const baseQuery: TempoQuery = { refId: 'A', queryType: 'flow' };

function makeDatasource() {
  return { query: jest.fn() } as unknown as Parameters<typeof FlowQuerySection>[0]['datasource'];
}

describe('FlowQuerySection', () => {
  it('renders the facet drill-down container', () => {
    render(
      <FlowQuerySection
        datasource={makeDatasource()}
        query={baseQuery}
        onChange={jest.fn()}
        onRunQuery={jest.fn()}
      />
    );
    expect(screen.getByText('Flow filters')).toBeInTheDocument();
  });
});
