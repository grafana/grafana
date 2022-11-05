import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { PrometheusDatasource } from '../datasource';

import { PromVariableQueryEditor, Props } from './VariableQueryEditor';

const refId = 'PrometheusVariableQueryEditor-VariableQuery';

describe('PromVariableQueryEditor', () => {
  let props: Props;

  beforeEach(() => {
    props = {
      datasource: {
        hasLabelsMatchAPISupport: () => 1,
        languageProvider: {
          start: () => Promise.resolve([]),
          syntax: () => {},
          getLabelKeys: () => [],
          metrics: [],
        },
        getInitHints: () => [],
      } as unknown as PrometheusDatasource,
      query: {
        refId: 'test',
        expr: 'label_names()',
      },
      onRunQuery: () => {},
      onChange: () => {},
      history: [],
    };
  });

  test('Displays a group of function options', async () => {
    render(<PromVariableQueryEditor {...props} />);

    const select = screen.getByLabelText('Function type').parentElement!;
    await userEvent.click(select);

    await waitFor(() => expect(screen.getAllByText('Label names')).toHaveLength(2));
    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Query result')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Match[] series')).toBeInTheDocument());
  });

  test('Calls onChange for label_names() query', async () => {
    const onChange = jest.fn();

    props.query = {
      refId: 'test',
      expr: '',
    };

    render(<PromVariableQueryEditor {...props} onChange={onChange} />);

    await selectOptionInTest(screen.getByLabelText('Function type'), 'Label names');

    expect(onChange).toHaveBeenCalledWith({
      expr: 'label_names()',
      refId,
    });
  });

  test('Does not call onChange for other queries', async () => {
    const onChange = jest.fn();

    render(<PromVariableQueryEditor {...props} onChange={onChange} />);

    await selectOptionInTest(screen.getByLabelText('Function type'), 'Metrics');
    await selectOptionInTest(screen.getByLabelText('Function type'), 'Query result');
    await selectOptionInTest(screen.getByLabelText('Function type'), 'Match[] series');

    expect(onChange).not.toHaveBeenCalled();
  });

  test('Calls onChange for metrics() with argument onBlur', async () => {
    const onChange = jest.fn();

    props.query = {
      refId: 'test',
      expr: 'metrics(a)',
    };

    render(<PromVariableQueryEditor {...props} onChange={onChange} />);

    const labelSelect = screen.getByLabelText('Metric selector');
    await userEvent.click(labelSelect);
    const functionSelect = screen.getByLabelText('Function type').parentElement!;
    await userEvent.click(functionSelect);

    expect(onChange).toHaveBeenCalledWith({
      expr: 'metrics(a)',
      refId,
    });
  });

  test('Calls onChange for query_result() with argument onBlur', async () => {
    const onChange = jest.fn();

    props.query = {
      refId: 'test',
      expr: 'query_result(a)',
    };

    render(<PromVariableQueryEditor {...props} onChange={onChange} />);

    const labelSelect = screen.getByLabelText('Prometheus Query');
    await userEvent.click(labelSelect);
    const functionSelect = screen.getByLabelText('Function type').parentElement!;
    await userEvent.click(functionSelect);

    expect(onChange).toHaveBeenCalledWith({
      expr: 'query_result(a)',
      refId,
    });
  });

  test('Calls onChange for Match[] series with argument onBlur', async () => {
    const onChange = jest.fn();

    props.query = {
      refId: 'test',
      expr: '{a: "example"}',
    };

    render(<PromVariableQueryEditor {...props} onChange={onChange} />);

    const labelSelect = screen.getByLabelText('Series Query');
    await userEvent.click(labelSelect);
    const functionSelect = screen.getByLabelText('Function type').parentElement!;
    await userEvent.click(functionSelect);

    expect(onChange).toHaveBeenCalledWith({
      expr: '{a: "example"}',
      refId,
    });
  });
});
