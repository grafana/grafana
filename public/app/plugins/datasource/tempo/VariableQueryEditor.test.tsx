import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplateSrv } from '@grafana/runtime';

import {
  TempoVariableQuery,
  TempoVariableQueryEditor,
  TempoVariableQueryEditorProps,
  TempoVariableQueryType,
} from './VariableQueryEditor';
import { selectOptionInTest } from './_importedDependencies/test/helpers/selectOptionInTest';
import { createTempoDatasource } from './test/mocks';

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
    await userEvent.click(document.body);

    // The Label field is rendered only after the query type has been selected.
    // We wait for it to be displayed to avoid flakyness.
    await waitFor(() => expect(screen.getByLabelText('Label')).toBeInTheDocument());

    await selectOptionInTest(screen.getByLabelText('Label'), 'luna');
    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: TempoVariableQueryType.LabelValues,
      label: 'luna',
      refId,
    });
  });
});
