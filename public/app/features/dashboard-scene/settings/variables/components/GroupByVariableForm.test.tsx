import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { byTestId } from 'testing-library-selector';

import { VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { GroupByVariableForm, GroupByVariableFormProps } from './GroupByVariableForm';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({
      ...defaultDatasource,
      variables: {
        getType: () => VariableSupportType.Custom,
        query: jest.fn(),
        editor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('GroupByVariableForm', () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      })),
    });
  });

  const onDataSourceChangeMock = jest.fn();
  const onDefaultOptionsChangeMock = jest.fn();
  const onAllowCustomValueChangeMock = jest.fn();

  const defaultProps: GroupByVariableFormProps = {
    allowCustomValue: true,
    onAllowCustomValueChange: onAllowCustomValueChangeMock,
    onDataSourceChange: onDataSourceChangeMock,
    onDefaultOptionsChange: onDefaultOptionsChangeMock,
    datasourceSupported: true,
  };

  function setup(props?: Partial<GroupByVariableFormProps>) {
    return {
      renderer: render(<GroupByVariableForm {...defaultProps} {...props} />),
      user: userEvent.setup(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form with allow custom value true', async () => {
    const mockOnAllowCustomValueChange = jest.fn();
    const {
      renderer: { getByTestId },
    } = setup({
      allowCustomValue: true,
      onAllowCustomValueChange: mockOnAllowCustomValueChange,
    });

    const allowCustomValueCheckbox = getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    expect(allowCustomValueCheckbox).toBeInTheDocument();
    expect(allowCustomValueCheckbox).toBeChecked();
  });

  it('should call onDataSourceChange when changing the datasource', async () => {
    const {
      renderer: { getByTestId },
    } = setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.inputV2);
    await userEvent.click(dataSourcePicker);
    await userEvent.click(screen.getByText(/prometheus/i));

    expect(onDataSourceChangeMock).toHaveBeenCalledTimes(1);
    expect(onDataSourceChangeMock).toHaveBeenCalledWith(promDatasource, undefined);
  });

  it('should not render code editor when no default options provided', async () => {
    const {
      renderer: { queryByTestId },
    } = setup();
    const codeEditor = queryByTestId(selectors.components.CodeEditor.container);

    expect(codeEditor).not.toBeInTheDocument();
  });

  it('should render code editor when default options provided', async () => {
    const {
      renderer: { getByTestId },
    } = setup({ defaultOptions: [{ text: 'test', value: 'test' }] });
    const codeEditor = getByTestId(selectors.components.CodeEditor.container);

    await byTestId(selectors.components.CodeEditor.container).find();

    expect(codeEditor).toBeInTheDocument();
  });

  it('should call onDefaultOptionsChange when providing static options', async () => {
    const {
      renderer: { getByTestId },
    } = setup();

    const toggle = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle);

    await userEvent.click(toggle);
    expect(onDefaultOptionsChangeMock).toHaveBeenCalledTimes(1);
    expect(onDefaultOptionsChangeMock).toHaveBeenCalledWith([]);
  });

  it('should call onDefaultOptionsChange when toggling off static options', async () => {
    const {
      renderer: { getByTestId },
    } = setup({ defaultOptions: [{ text: 'test', value: 'test' }] });

    const toggle = getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.modeToggle);

    await userEvent.click(toggle);
    expect(onDefaultOptionsChangeMock).toHaveBeenCalledTimes(1);
    expect(onDefaultOptionsChangeMock).toHaveBeenCalledWith(undefined);
  });

  it('should call onDefaultValueChange when selecting a default value', async () => {
    const mockOnDefaultValueChange = jest.fn();
    const { user } = setup({
      defaultValue: [],
      defaultValueOptions: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
      onDefaultValueChange: mockOnDefaultValueChange,
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.click(await screen.findByRole('option', { name: 'job' }));
    expect(mockOnDefaultValueChange).toHaveBeenCalledWith([expect.objectContaining({ label: 'job', value: 'job' })]);
  });

  it('should call onDefaultValueChange when removing a default value via pill', async () => {
    const mockOnDefaultValueChange = jest.fn();
    const { user } = setup({
      defaultValue: [{ value: 'job', label: 'job' }],
      defaultValueOptions: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
      onDefaultValueChange: mockOnDefaultValueChange,
    });

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mockOnDefaultValueChange).toHaveBeenCalledWith([]);
  });

  it('should show defaultValueOptions in combobox dropdown', async () => {
    const mockOnDefaultValueChange = jest.fn();
    const { user } = setup({
      defaultValue: [],
      defaultValueOptions: [
        { label: 'job', value: 'job' },
        { label: 'instance', value: 'instance' },
      ],
      onDefaultValueChange: mockOnDefaultValueChange,
    });

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    expect(await screen.findByRole('option', { name: 'job' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'instance' })).toBeInTheDocument();
  });

  it('should render only datasource picker and alert when not supported', async () => {
    const mockOnAllowCustomValueChange = jest.fn();
    const { renderer } = await setup({
      ...defaultProps,
      datasourceSupported: false,
      onAllowCustomValueChange: mockOnAllowCustomValueChange,
    });

    const dataSourcePicker = renderer.getByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect
    );

    const allowCustomValueCheckbox = renderer.queryByTestId(
      selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
    );

    const alertText = renderer.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.infoText);

    expect(dataSourcePicker).toBeInTheDocument();
    expect(allowCustomValueCheckbox).not.toBeInTheDocument();
    expect(alertText).toBeInTheDocument();
  });
});
