import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { TemplateSrv } from '@grafana/runtime';

import { createLokiDatasource } from '../mocks';
import { LokiVariableQueryType } from '../types';

import { LokiVariableQueryEditor, Props } from './VariableQueryEditor';

const props: Props = {
  datasource: createLokiDatasource({} as unknown as TemplateSrv),
  query: {
    refId: 'test',
    type: LokiVariableQueryType.LabelNames,
  },
  onRunQuery: () => {},
  onChange: () => {},
};

describe('LokiVariableQueryEditor', () => {
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

    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
    await userEvent.type(screen.getByLabelText('Label'), 'label');
    await userEvent.type(screen.getByLabelText('Stream selector'), 'stream');

    await waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());

    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: 'stream',
      refId: 'LokiVariableQueryEditor-VariableQuery',
    });
  });

  test('Migrates legacy string queries to LokiVariableQuery instances', async () => {
    const query = 'label_values(log stream selector, label)';

    // @ts-expect-error
    render(<LokiVariableQueryEditor {...props} onChange={() => {}} query={query} />);

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('label')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });
});
