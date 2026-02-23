import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ARGScope } from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';

import ArgQueryEditor from './ArgQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

const defaultProps = {
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: variableOptionGroup,
  onChange: jest.fn(),
  setError: jest.fn(),
};

describe('ArgQueryEditor', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });
  it('should render', async () => {
    render(<ArgQueryEditor {...defaultProps} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
  });

  it('should change the scope to directory', async () => {
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
    });
    const onChange = jest.fn();
    render(<ArgQueryEditor {...defaultProps} datasource={datasource} onChange={onChange} />);
    expect(await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.scope.input)).toBeInTheDocument();

    const scopeSelector = screen.getByTestId(selectors.components.queryEditor.argsQueryEditor.scope.input);

    await userEvent.click(scopeSelector);
    const directoryOption = await screen.findByRole('option', { name: 'Directory' });
    await userEvent.click(directoryOption);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureResourceGraph: {
          query: 'Resources | summarize count()',
          resultFormat: 'table',
          scope: ARGScope.Directory,
        },
        subscriptions: [],
      })
    );
  });

  it('should select a subscription from the fetched array', async () => {
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
    });
    const onChange = jest.fn();
    render(<ArgQueryEditor {...defaultProps} datasource={datasource} onChange={onChange} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo'] }));
  });

  it('should select a subscription from existing query', async () => {
    const onChange = jest.fn();
    const query = createMockQuery({
      subscriptions: ['bar'],
    });
    render(<ArgQueryEditor {...defaultProps} onChange={onChange} query={query} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['bar'] }));
  });

  it('should change the subscription if the selected one is not part of the fetched array', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
    });
    const query = createMockQuery({
      subscriptions: ['bar'],
    });
    render(<ArgQueryEditor {...defaultProps} datasource={datasource} onChange={onChange} query={query} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo'] }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['bar'] }));
  });

  it('should keep a subset of subscriptions if the new list does not contain all the query subscriptions', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }, { value: 'bar' }]),
    });
    const query = createMockQuery({
      subscriptions: ['foo', 'bar', 'foobar'],
    });
    render(<ArgQueryEditor {...defaultProps} datasource={datasource} onChange={onChange} query={query} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo', 'bar'] }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['foo', 'bar', 'foobar'] }));
  });

  it('should keep a template variable if used in the subscription field', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ value: 'foo' }]),
    });
    const query = createMockQuery({
      subscriptions: ['$test'],
    });
    render(
      <ArgQueryEditor
        {...defaultProps}
        datasource={datasource}
        onChange={onChange}
        query={query}
        variableOptionGroup={{ label: 'Template Variables', options: [{ label: '$test', value: '$test' }] }}
      />
    );
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.subscriptions.input)
    ).toHaveTextContent('$test');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: ['$test'] }));
  });

  it('should display an error if no subscription is selected', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([]),
    });
    const query = createMockQuery({
      subscriptions: [],
    });
    render(
      <ArgQueryEditor
        {...defaultProps}
        datasource={datasource}
        onChange={onChange}
        query={query}
        variableOptionGroup={{ label: 'Template Variables', options: [] }}
      />
    );

    expect(await waitFor(() => screen.getByText('At least one subscription must be chosen.'))).toBeInTheDocument();
  });

  it('should display an error if subscriptions are cleared', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([{ text: 'foo', value: 'test-subscription-value' }]),
    });
    const query = createMockQuery({
      subscription: undefined,
      subscriptions: ['test-subscription-value'],
    });
    const { rerender } = render(
      <ArgQueryEditor
        {...defaultProps}
        query={query}
        datasource={datasource}
        onChange={onChange}
        variableOptionGroup={{ label: 'Template Variables', options: [] }}
      />
    );

    expect(datasource.getSubscriptions).toHaveBeenCalled();
    expect(await waitFor(() => onChange)).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptions: ['test-subscription-value'] })
    );
    expect(await waitFor(() => screen.findByText('foo'))).toBeInTheDocument();

    const clear = screen.getByLabelText('Clear value');
    await userEvent.click(clear);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subscriptions: [] }));

    rerender(
      <ArgQueryEditor
        {...defaultProps}
        datasource={datasource}
        onChange={onChange}
        query={{ ...query, subscriptions: [] }}
        variableOptionGroup={{ label: 'Template Variables', options: [] }}
      />
    );
    expect(await waitFor(() => screen.getByText('At least one subscription must be chosen.'))).toBeInTheDocument();
  });

  it('should select all subscriptions if select all is chosen from the dropdown', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getSubscriptions: jest.fn().mockResolvedValue([
        { text: 'foo', value: 'test-subscription-value1' },
        { text: 'bar', value: 'test-subscription-value2' },
        { text: 'Select all subscriptions', value: 'Select all' },
      ]),
    });
    const query = createMockQuery({
      subscription: undefined,
      subscriptions: ['test-subscription-value1', 'test-subscription-value2', 'Select all'],
    });
    const { rerender } = render(
      <ArgQueryEditor
        {...defaultProps}
        query={query}
        datasource={datasource}
        onChange={onChange}
        variableOptionGroup={{ label: 'Template Variables', options: [] }}
      />
    );

    expect(datasource.getSubscriptions).toHaveBeenCalled();
    expect(await waitFor(() => onChange)).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptions: ['test-subscription-value1', 'test-subscription-value2', 'Select all'] })
    );
    expect(await waitFor(() => screen.findByText('foo'))).toBeInTheDocument();
    expect(await waitFor(() => screen.findByText('bar'))).toBeInTheDocument();
    expect(await waitFor(() => screen.findByText('Select all subscriptions'))).toBeInTheDocument();

    const selectAll = screen.getByText('Select all subscriptions');
    await userEvent.click(selectAll);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptions: ['test-subscription-value1', 'test-subscription-value2', 'Select all'] })
    );

    rerender(
      <ArgQueryEditor
        {...defaultProps}
        datasource={datasource}
        onChange={onChange}
        query={{ ...query, subscriptions: ['test-subscription-value1', 'test-subscription-value2', 'Select all'] }}
        variableOptionGroup={{ label: 'Template Variables', options: [] }}
      />
    );
    expect(await waitFor(() => screen.getByText('foo'))).toBeInTheDocument();
    expect(await waitFor(() => screen.getByText('bar'))).toBeInTheDocument();
  });
});
