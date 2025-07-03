import { render, screen, act } from '@testing-library/react';
import { openMenu } from 'react-select-event';

import { selectors } from '../../e2e/selectors';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';

import TraceTypeField from './TraceTypeField';
import { Tables } from './consts';
import { setTraceTypes } from './setQueryValue';

const props = {
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
};

describe('TraceTypeField', () => {
  it('should render with default types', async () => {
    const query = {
      ...props.query,
      azureTraces: {
        ...props.query.azureTraces,
      },
    };

    render(<TraceTypeField {...props} query={query} />);

    const menu = screen.getByLabelText(selectors.components.queryEditor.tracesQueryEditor.traceTypes.select);
    openMenu(menu);

    Object.values(Tables).forEach((table) => {
      expect(screen.getByText(table.label)).toBeInTheDocument();
    });
  });

  it('should render the value defined in the query', async () => {
    render(<TraceTypeField {...props} />);
    expect(screen.getByText('Traces')).toBeInTheDocument();
  });

  it('should update the query', async () => {
    const { rerender } = render(<TraceTypeField {...props} />);

    expect(screen.getByText('Traces')).toBeInTheDocument();

    const menu = screen.getByLabelText(selectors.components.queryEditor.tracesQueryEditor.traceTypes.select);

    openMenu(menu);
    act(() => {
      screen.getByText('Dependencies').click();
    });

    const newQuery = setTraceTypes(props.query, [...props.query.azureTraces?.traceTypes!, 'dependencies']);

    expect(props.onQueryChange).toHaveBeenCalledWith(newQuery);
    rerender(<TraceTypeField {...props} query={newQuery} />);
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
  });
});
