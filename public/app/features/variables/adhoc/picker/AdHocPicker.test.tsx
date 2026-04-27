import { screen, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import type { AdHocVariableModel } from '@grafana/data/types';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { adHocBuilder } from '../../shared/testing/builders';
import { getPreloadedState } from '../../state/helpers';
import * as actions from '../actions';

import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocPicker } from './AdHocPicker';

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
  const templatingState = {
    variables: {
      [variable.id]: { ...variable },
    },
  };
  const preloadedState = getPreloadedState('key', templatingState);

  const renderResult = render(<AdHocPicker variable={variable} readOnly={readOnly} />, { preloadedState });

  return { variable, ...renderResult };
}

function getButtonFromTestId(testid: string) {
  const wrapper = screen.getByTestId(testid);

  return within(wrapper).getByRole('button');
}

describe('AdHocPicker', () => {
  let addFilterSpy: jest.SpyInstance;
  let removeFilterSpy: jest.SpyInstance;
  let changeFilterSpy: jest.SpyInstance;

  beforeEach(() => {
    // Return no-op thunks to prevent real redux side effects (registry lookups, variableUpdated, etc.)
    const noopThunk = () => async () => {};
    addFilterSpy = jest.spyOn(actions, 'addFilter').mockImplementation(noopThunk);
    removeFilterSpy = jest.spyOn(actions, 'removeFilter').mockImplementation(noopThunk);
    changeFilterSpy = jest.spyOn(actions, 'changeFilter').mockImplementation(noopThunk);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('dispatches addFilter with keyed identifier and filter', async () => {
    const { variable, user } = setup();

    // click the key segment
    await user.click(getButtonFromTestId('AdHocFilterKey-add-key-wrapper'));

    // results from mocked getTagKeys() function in setup
    expect(screen.getByText('1 result available.')).toBeInTheDocument();

    // choose a new key
    await user.click(screen.getByText('app'));

    // click the value segment
    await user.click(screen.getByText('Select value'));

    // results from mocked getTagValues() function in setup
    expect(screen.getByText('2 results available.')).toBeInTheDocument();

    // choose a new value
    await user.click(screen.getByText('backend'));

    expect(addFilterSpy).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      { key: 'app', operator: '=', value: 'backend' }
    );
  });

  it('dispatches removeFilter with keyed identifier and index', async () => {
    const { variable, user } = setup();

    // click the key segment
    await user.click(getButtonFromTestId('AdHocFilterKey-key-wrapper'));

    // find the remove filter option by text
    const removeOption = screen.getByText(REMOVE_FILTER_KEY);
    expect(removeOption).toBeInTheDocument();

    // click the remove filter option
    await user.click(removeOption);

    expect(removeFilterSpy).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      0
    );
  });

  it('dispatches changeFilter with keyed identifier and change payload', async () => {
    const { variable, user } = setup();

    // click the value segment
    await user.click(getButtonFromTestId('AdHocFilterValue-value-wrapper'));

    // results from mocked getTagValues() function in setup
    expect(screen.getByText('2 results available.')).toBeInTheDocument();

    // click the backend value
    await user.click(screen.getByText('backend'));

    expect(changeFilterSpy).toHaveBeenCalledWith(
      { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey },
      { index: 0, filter: { key: 'env', operator: '=', value: 'backend' } }
    );
  });
});
