import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Form } from 'app/core/components/Form/Form';

import { type DashboardInputs, InputType, type ImportFormDataV2 } from '../../types';

import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const mockInputs: DashboardInputs = {
  dataSources: [
    {
      name: 'Prometheus',
      label: 'Prometheus',
      pluginId: 'prometheus',
      type: InputType.DataSource,
      description: 'Select a Prometheus data source',
      info: 'Select prometheus',
      value: '',
    },
    {
      name: 'Loki',
      label: 'Loki',
      pluginId: 'loki',
      type: InputType.DataSource,
      description: 'Select a Loki data source',
      info: 'Select loki',
      value: '',
    },
  ],
  constants: [],
  libraryPanels: [],
};

jest.mock('../utils/validation', () => ({
  validateTitle: jest.fn().mockResolvedValue(true),
  validateUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: ({ value, onChange }: { value: string; onChange: (val: string, title: string) => void }) => (
    <input data-testid="folder-picker" value={value} onChange={(e) => onChange(e.target.value, 'Test Folder')} />
  ),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({
    onChange,
    pluginId,
    current,
  }: {
    onChange: (ds: { uid: string; type: string; name: string }) => void;
    pluginId: string;
    current?: { uid: string; type: string };
  }) => (
    <input
      data-testid={`datasource-picker-${pluginId}`}
      value={current?.uid || ''}
      onChange={(e) =>
        onChange({
          uid: e.target.value,
          type: pluginId,
          name: `${pluginId} instance`,
        })
      }
    />
  ),
}));

describe('ImportDashboardFormV2', () => {
  const mockOnCancel = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnFolderChange = jest.fn();

  function renderForm(
    hasFloatGridItems = false,
    inputs: DashboardInputs = mockInputs,
    dashboardUid?: string,
    onFolderChange?: (uid: string) => void
  ) {
    const defaultDashboard: DashboardV2Spec = defaultSpec();
    return render(
      <Form<ImportFormDataV2>
        onSubmit={mockOnSubmit}
        defaultValues={{
          dashboard: defaultDashboard,
          folderUid: 'test-folder',
          ...(dashboardUid !== undefined ? { k8s: { name: dashboardUid } } : {}),
        }}
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportDashboardFormV2
            register={register}
            inputs={inputs}
            errors={errors}
            control={control}
            getValues={getValues}
            onCancel={mockOnCancel}
            onSubmit={mockOnSubmit}
            watch={watch}
            hasFloatGridItems={hasFloatGridItems}
            onFolderChange={onFolderChange}
          />
        )}
      </Form>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders float grid items warning when hasFloatGridItems is true', () => {
    renderForm(true);
    expect(screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)).toBeInTheDocument();
  });

  it('does not render float grid items warning when hasFloatGridItems is false', () => {
    renderForm(false);
    expect(
      screen.queryByTestId(selectors.components.ImportDashboardForm.floatGridItemsWarning)
    ).not.toBeInTheDocument();
  });

  it('renders the original datasource name on the field label when label and name differ', () => {
    const inputs: DashboardInputs = {
      ...mockInputs,
      dataSources: [
        {
          name: 'mysql-1',
          label: 'mysql-1 (Production MySQL)',
          pluginId: 'mysql',
          type: InputType.DataSource,
          description: 'mysql data source — originally "Production MySQL"',
          info: 'Select a mysql data source',
          value: '',
        },
        {
          name: 'mysql-2',
          label: 'mysql-2 (Reports MySQL)',
          pluginId: 'mysql',
          type: InputType.DataSource,
          description: 'mysql data source — originally "Reports MySQL"',
          info: 'Select a mysql data source',
          value: '',
        },
      ],
    };

    renderForm(false, inputs);

    expect(screen.getByText('mysql-1 (Production MySQL)')).toBeInTheDocument();
    expect(screen.getByText('mysql-2 (Reports MySQL)')).toBeInTheDocument();
  });

  it('renders a tooltip listing panels that reference the datasource', async () => {
    const user = userEvent.setup();
    const inputs: DashboardInputs = {
      ...mockInputs,
      dataSources: [
        {
          name: 'mysql-1',
          label: 'mysql-1 (Production MySQL)',
          pluginId: 'mysql',
          type: InputType.DataSource,
          description: 'mysql data source — originally "Production MySQL"',
          info: 'Select a mysql data source',
          value: '',
          usedByPanels: ['CPU usage', 'Memory usage'],
        },
      ],
    };

    renderForm(false, inputs);

    const infoIcon = screen.getByLabelText('Show panels that use this datasource');
    expect(infoIcon).toBeInTheDocument();

    await user.hover(infoIcon);

    expect(await screen.findByText('Used by panels:')).toBeInTheDocument();
    expect(screen.getByText('CPU usage')).toBeInTheDocument();
    expect(screen.getByText('Memory usage')).toBeInTheDocument();
  });

  it('does not render the tooltip when no panels reference the datasource', () => {
    renderForm(false);

    expect(screen.queryByLabelText('Show panels that use this datasource')).not.toBeInTheDocument();
  });

  it('renders UID field as read-only first and enables editing after clicking change uid', async () => {
    const user = userEvent.setup();
    renderForm(false, mockInputs, 'existing-uid');

    const uidField = document.querySelector('input[name="k8s.name"]') as HTMLInputElement;
    expect(uidField).toHaveValue('existing-uid');
    expect(uidField).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /change uid/i }));

    const editableUidField = document.querySelector('input[name="k8s.name"]') as HTMLInputElement;
    expect(editableUidField).toBeEnabled();
  });

  it('calls onFolderChange when folder picker value changes', async () => {
    const user = userEvent.setup();
    renderForm(false, mockInputs, undefined, mockOnFolderChange);

    const folderPicker = screen.getByTestId('folder-picker');
    await user.clear(folderPicker);
    await user.type(folderPicker, 'new-folder');

    expect(mockOnFolderChange).toHaveBeenCalledWith('new-folder');
  });

  it('works without onFolderChange callback (optional prop)', async () => {
    const user = userEvent.setup();
    renderForm(false, mockInputs, undefined, undefined);

    const folderPicker = screen.getByTestId('folder-picker');
    // Should not throw when changing folder without callback
    await user.clear(folderPicker);
    await user.type(folderPicker, 'some-folder');

    expect(folderPicker).toHaveValue('some-folder');
  });
});
