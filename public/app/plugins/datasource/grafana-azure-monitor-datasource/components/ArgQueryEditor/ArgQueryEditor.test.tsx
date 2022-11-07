import { render, screen } from '@testing-library/react';
import React from 'react';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { selectors } from '../../e2e/selectors';

import ArgQueryEditor from './ArgQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
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
  it('should render', async () => {
    render(<ArgQueryEditor {...defaultProps} />);
    expect(
      await screen.findByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)
    ).toBeInTheDocument();
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
});
