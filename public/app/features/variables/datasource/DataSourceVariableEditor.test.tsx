import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(selectContainer).toHaveTextContent('Choose');
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

  it('calls the handler when the regex filter is changed in onBlur', async () => {
    const { user } = setup(<DataSourceVariableEditor {...props} />);
    const field = screen.getByLabelText(/Instance name filter/);
    await user.click(field);
    await user.type(field, '/prod/');
    expect(field).toHaveValue('/prod/');
    await user.tab();
    expect(props.onPropChange).toHaveBeenCalledWith({ propName: 'regex', propValue: '/prod/', updateOptions: true });
  });
});

// based on styleguide recomendation
function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}
