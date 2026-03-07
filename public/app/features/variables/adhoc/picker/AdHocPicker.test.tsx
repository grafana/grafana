import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdHocVariableModel } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { adHocBuilder } from '../../shared/testing/builders';

import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocPickerUnconnected } from './AdHocPicker';

const defaultVariable = adHocBuilder()
  .withId('adhoc0')
  .withRootStateKey('key')
  .withDatasource({ uid: 'ds1' })
  .withFilters([{ key: 'env', operator: '=', value: 'prod' }])
  .build();

function setup(overrides: Partial<AdHocVariableModel> = {}, readOnly = false) {
  setDataSourceSrv({
    get() {
      return {
        getTagKeys() {
          return [{ text: 'app' }];
        },
        getTagValues() {
          return [{ text: 'frontend' }, { text: 'backend' }];
        },
      };
    },
  } as unknown as DataSourceSrv);

  const variable = { ...defaultVariable, ...overrides };
  const addFilter = jest.fn();
  const removeFilter = jest.fn();
  const changeFilter = jest.fn();
  const user = userEvent.setup();

  const renderResult = render(
    <AdHocPickerUnconnected
      variable={variable}
      readOnly={readOnly}
      addFilter={addFilter}
      removeFilter={removeFilter}
      changeFilter={changeFilter}
    />
  );

  return { addFilter, removeFilter, changeFilter, variable, ...renderResult, user };
}

function getButtonFromTestId(testid: string) {
  const wrapper = screen.getByTestId(testid);

  return within(wrapper).getByRole('button');
}

describe('AdHocPickerUnconnected', () => {
  it('renders correct AdHocFilter', () => {
    const { getByTestId } = setup();

    expect(getByTestId('AdHocFilterKey-key-wrapper')).toHaveTextContent('env');
    expect(getButtonFromTestId('AdHocFilterKey-key-wrapper')).not.toBeDisabled();

    expect(getByTestId('OperatorSegment-value-wrapper')).toHaveTextContent('=');
    expect(getButtonFromTestId('OperatorSegment-value-wrapper')).not.toBeDisabled();

    expect(getByTestId('AdHocFilterValue-value-wrapper')).toHaveTextContent('prod');
    expect(getButtonFromTestId('AdHocFilterValue-value-wrapper')).not.toBeDisabled();

    expect(getByTestId('AdHocFilterKey-add-key-wrapper')).toBeInTheDocument();
    expect(getButtonFromTestId('AdHocFilterKey-add-key-wrapper')).not.toBeDisabled();
  });

  it('should disable controls when readonly and hide add new segment button', () => {
    const { getByTestId, queryByTestId } = setup({}, true);

    expect(getByTestId('AdHocFilterKey-key-wrapper')).toHaveTextContent('env');
    expect(getButtonFromTestId('AdHocFilterKey-key-wrapper')).toBeDisabled();

    expect(getByTestId('OperatorSegment-value-wrapper')).toHaveTextContent('=');
    expect(getButtonFromTestId('OperatorSegment-value-wrapper')).toBeDisabled();

    expect(getByTestId('AdHocFilterValue-value-wrapper')).toHaveTextContent('prod');
    expect(getButtonFromTestId('AdHocFilterValue-value-wrapper')).toBeDisabled();

    expect(queryByTestId('AdHocFilterKey-add-key-wrapper')).not.toBeInTheDocument();
  });

  it('calls addFilter with keyed identifier and filter', async () => {
    const { addFilter, variable, user, getByText } = setup();

    // click the key segment
    await user.click(getButtonFromTestId('AdHocFilterKey-add-key-wrapper'));

    // results from mocked getTagKeys() function in setup
    expect(getByText('1 result available.')).toBeInTheDocument();

    // choose a new key
    await user.click(getByText('app'));

    // click the value segment
    await user.click(getByText('Select value'));

    // results from mocked getTagValues() function in setup
    expect(getByText('2 results available.')).toBeInTheDocument();

    // choose a new value
    await user.click(getByText('backend'));

    expect(addFilter).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      { key: 'app', operator: '=', value: 'backend' }
    );
  });

  it('calls removeFilter with keyed identifier and filter', async () => {
    const { removeFilter, variable, user, getByText } = setup();

    // click the key segment
    await user.click(getButtonFromTestId('AdHocFilterKey-key-wrapper'));

    // find the remove filter option by text
    const removeOption = getByText(REMOVE_FILTER_KEY);
    expect(removeOption).toBeInTheDocument();

    // click the remove filter option
    await user.click(removeOption);

    expect(removeFilter).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      0
    );
  });

  it('calls changeFilter with keyed identifier and change payload', async () => {
    const { changeFilter, variable, getByText, user } = setup();

    // click the value segment
    await user.click(getButtonFromTestId('AdHocFilterValue-value-wrapper'));

    // results from mocked getTagValues() function in setup
    expect(getByText('2 results available.')).toBeInTheDocument();

    // click the backend value
    await user.click(getByText('backend'));

    expect(changeFilter).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      { index: 0, filter: { key: 'env', operator: '=', value: 'backend' } }
    );
  });
});
