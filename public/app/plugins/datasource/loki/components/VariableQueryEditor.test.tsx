import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { TemplateSrv } from '@grafana/runtime';

import { createLokiDatasource } from '../mocks';
import { LokiVariableQueryType } from '../types';

import { LokiVariableQueryEditor, Props } from './VariableQueryEditor';

const refId = 'LokiVariableQueryEditor-VariableQuery';

describe('LokiVariableQueryEditor', () => {
  let props: Props;

  beforeEach(() => {
    props = {
      datasource: createLokiDatasource({} as unknown as TemplateSrv),
      query: {
        refId: 'test',
        type: LokiVariableQueryType.LabelNames,
      },
      onRunQuery: () => {},
      onChange: () => {},
    };

    jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([
      {
        text: 'moon',
      },
      {
        text: 'luna',
      },
    ]);
  });

  test('Allows to create a Label names variable', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: '',
      stream: '',
      refId,
    });
  });

  test('Allows to create a Label values variable', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
    await selectOptionInTest(screen.getByLabelText('Label'), 'luna');
    await userEvent.type(screen.getByLabelText('Stream selector'), 'stream');

    await waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());

    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: 'luna',
      stream: 'stream',
      refId,
    });
  });

  test('Allows to create a Label values variable with custom label', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
    await userEvent.type(screen.getByLabelText('Label'), 'sol{enter}');
    await userEvent.type(screen.getByLabelText('Stream selector'), 'stream');

    await waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());

    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: 'sol',
      stream: 'stream',
      refId,
    });
  });

  test('Migrates legacy string queries to LokiVariableQuery instances', async () => {
    const query = 'label_values(log stream selector, luna)';
    // @ts-expect-error
    render(<LokiVariableQueryEditor {...props} onChange={() => {}} query={query} />);

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });

  test('Receives a query instance and assigns its values when editing', async () => {
    render(
      <LokiVariableQueryEditor
        {...props}
        onChange={() => {}}
        query={{
          type: LokiVariableQueryType.LabelValues,
          label: 'luna',
          stream: 'log stream selector',
          refId,
        }}
      />
    );

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });

  test('Label options are not lost when selecting one', async () => {
    const { rerender } = render(<LokiVariableQueryEditor {...props} onChange={() => {}} />);

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
    await selectOptionInTest(screen.getByLabelText('Label'), 'luna');

    const updatedQuery = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'luna',
    };
    rerender(<LokiVariableQueryEditor {...props} query={updatedQuery} onChange={() => {}} />);

    await selectOptionInTest(screen.getByLabelText('Label'), 'moon');
    await selectOptionInTest(screen.getByLabelText('Label'), 'luna');
    await screen.findByText('luna');
  });
});
