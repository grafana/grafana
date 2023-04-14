import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest, getSelectParent } from 'test/helpers/selectOptionInTest';

import { DataSourceVariableEditorUnConnected as DataSourceVariableEditor } from './DataSourceVariableEditor';
import { initialDataSourceVariableModelState } from './reducer';

const props = {
  extended: {
    dataSourceTypes: [
      { text: 'Prometheus', value: 'ds-prom' },
      { text: 'Loki', value: 'ds-loki' },
    ],
  },
  variable: { ...initialDataSourceVariableModelState, rootStateKey: 'foo' },
  onPropChange: jest.fn(),

  // connected actions
  initDataSourceVariableEditor: jest.fn(),
  changeVariableMultiValue: jest.fn(),
};

describe('DataSourceVariableEditor', () => {
  beforeEach(() => {
    props.onPropChange.mockReset();
  });

  it('has a data source select menu', () => {
    render(<DataSourceVariableEditor {...props} />);

    const selectContainer = getSelectParent(screen.getByLabelText('Type'));
    expect(selectContainer).toHaveTextContent('Prometheus');
  });

  it('calls the handler when the data source is changed', async () => {
    render(<DataSourceVariableEditor {...props} />);
    await selectOptionInTest(screen.getByLabelText('Type'), 'Loki');

    expect(props.onPropChange).toBeCalledWith({ propName: 'query', propValue: 'ds-loki', updateOptions: true });
  });

  it('has a regex filter field', () => {
    render(<DataSourceVariableEditor {...props} />);
    const field = screen.getByLabelText(/Instance name filter/);
    expect(field).toBeInTheDocument();
  });

  it('calls the handler when the regex filter is changed', () => {
    render(<DataSourceVariableEditor {...props} />);
    const field = screen.getByLabelText(/Instance name filter/);
    fireEvent.change(field, { target: { value: '/prod/' } });
    expect(props.onPropChange).toBeCalledWith({ propName: 'regex', propValue: '/prod/' });
  });
});
