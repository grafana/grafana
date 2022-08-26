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
    type: LokiVariableQueryType.labelNames,
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
      type: LokiVariableQueryType.labelNames,
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
      type: LokiVariableQueryType.labelValues,
      label: 'label',
      stream: 'stream',
      refId: 'LokiVariableQueryEditor-VariableQuery',
    });
  });
});
