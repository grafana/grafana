import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { TemplateSrv } from '@grafana/runtime';

import {
  TempoVariableQuery,
  TempoVariableQueryEditor,
  TempoVariableQueryEditorProps,
  TempoVariableQueryType,
} from './VariableQueryEditor';
import { createTempoDatasource } from './mocks';

const refId = 'TempoDatasourceVariableQueryEditor-VariableQuery';

describe('TempoVariableQueryEditor', () => {
  let props: TempoVariableQueryEditorProps;
  let onChange: (value: TempoVariableQuery) => void;

  beforeEach(() => {
    props = {
      datasource: createTempoDatasource({} as unknown as TemplateSrv),
      query: { type: 0, refId: 'test' },
      onChange: (_: TempoVariableQuery) => {},
    };

    onChange = jest.fn();
  });

  test('Allows to create a Label names variable', async () => {
    expect(onChange).not.toHaveBeenCalled();
    render(<TempoVariableQueryEditor {...props} onChange={onChange} />);

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');
    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: TempoVariableQueryType.LabelNames,
      label: '',
      refId,
    });
  });

  test('Allows to create a Label values variable', async () => {
    jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([
      {
        text: 'moon',
      },
      {
        text: 'luna',
      },
    ]);
    expect(onChange).not.toHaveBeenCalled();
    render(<TempoVariableQueryEditor {...props} onChange={onChange} />);

    await selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
    await selectOptionInTest(screen.getByLabelText('Label'), 'luna');
    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: TempoVariableQueryType.LabelValues,
      label: 'luna',
      refId,
    });
  });
});
