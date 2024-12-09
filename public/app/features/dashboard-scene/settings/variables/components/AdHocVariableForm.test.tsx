import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { AdHocVariableForm, AdHocVariableFormProps } from './AdHocVariableForm';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  uid: 'test-ds',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  uid: 'prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => ({
  ...jest.requireActual('@grafana/runtime/src/services/dataSourceSrv'),
  getDataSourceSrv: () => ({
    get: async () => defaultDatasource,
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('AdHocVariableForm', () => {
  const onDataSourceChange = jest.fn();
  const defaultProps: AdHocVariableFormProps = {
    datasource: defaultDatasource,
    onDataSourceChange,
    infoText: 'Test Info',
  };

  it('should render the form with the provided data source', async () => {
    const { renderer } = await setup(defaultProps);

    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
    );
    const infoText = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText
    );

    expect(dataSourcePicker).toBeInTheDocument();
    expect(dataSourcePicker.getAttribute('placeholder')).toBe('Default Test Data Source');
    expect(infoText).toBeInTheDocument();
    expect(infoText).toHaveTextContent('Test Info');
  });

  it('should call the onDataSourceChange callback when the data source is changed', async () => {
    const { renderer, user } = await setup(defaultProps);

    // Simulate changing the data source
    await user.click(renderer.getByTestId(selectors.components.DataSourcePicker.inputV2));
    await user.click(renderer.getByText(/prom/i));

    expect(onDataSourceChange).toHaveBeenCalledTimes(1);
    expect(onDataSourceChange).toHaveBeenCalledWith(promDatasource, undefined);
  });

  it('should render the form with allow custom value true', async () => {
    const mockOnAllowCustomValueChange = jest.fn();
    const { renderer } = await setup({
      ...defaultProps,
      allowCustomValue: true,
      onAllowCustomValueChange: mockOnAllowCustomValueChange,
    });

    const allowCustomValueCheckbox = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
  });

  it('should not render code editor when no default keys provided', async () => {
    await setup(defaultProps);

    expect(screen.queryByTestId(selectors.components.CodeEditor.container)).not.toBeInTheDocument();
  });

  it('should render code editor when defaultKeys and onDefaultKeysChange are provided', async () => {
    const mockOnStaticKeysChange = jest.fn();
    await setup({
      ...defaultProps,
      defaultKeys: [{ text: 'test', value: 'test' }],
      onDefaultKeysChange: mockOnStaticKeysChange,
    });

    expect(await screen.findByTestId(selectors.components.CodeEditor.container)).toBeInTheDocument();
  });

  it('should call onDefaultKeysChange when toggling on default options', async () => {
    const mockOnStaticKeysChange = jest.fn();
    await setup({
      ...defaultProps,
      onDefaultKeysChange: mockOnStaticKeysChange,
    });

    await userEvent.click(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );
    expect(mockOnStaticKeysChange).toHaveBeenCalledTimes(1);
    expect(mockOnStaticKeysChange).toHaveBeenCalledWith([]);
  });

  it('should call onDefaultKeysChange when toggling off default options', async () => {
    const mockOnStaticKeysChange = jest.fn();
    await setup({
      ...defaultProps,
      defaultKeys: [{ text: 'test', value: 'test' }],
      onDefaultKeysChange: mockOnStaticKeysChange,
    });

    await userEvent.click(
      screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle)
    );
    expect(mockOnStaticKeysChange).toHaveBeenCalledTimes(1);
    expect(mockOnStaticKeysChange).toHaveBeenCalledWith(undefined);
  });
});

async function setup(props?: React.ComponentProps<typeof AdHocVariableForm>) {
  return {
    renderer: await act(() => render(<AdHocVariableForm onDataSourceChange={jest.fn()} {...props} />)),
    user: userEvent.setup(),
  };
}
