import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { TemplateSrv } from '@grafana/runtime';

import { createLokiDatasource } from '../mocks';
import { LokiVariableQueryType } from '../types';

import { LokiVariableQueryEditor, Props } from './VariableQueryEditor';

let props: Props;

describe('LokiVariableQueryEditor', () => {
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

    jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([]);
  });

  test('Allows to create a Label names variable', async () => {
    const onChange = jest.fn();

    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelNames,
      label: '',
      stream: '',
      refId: 'LokiVariableQueryEditor-VariableQuery',
    });
  });

  test('Allows to create a Label values variable', async () => {
    const onChange = jest.fn();
    jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([
      {
        text: 'moon',
      },
      {
        text: 'luna',
      },
    ]);

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
      refId: 'LokiVariableQueryEditor-VariableQuery',
    });
  });

  test('Migrates legacy string queries to LokiVariableQuery instances', async () => {
    const query = 'label_values(log stream selector, label_selector)';

    // @ts-expect-error
    render(<LokiVariableQueryEditor {...props} onChange={() => {}} query={query} />);

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('label_selector')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });
});
