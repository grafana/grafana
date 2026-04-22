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

  function renderForm(hasFloatGridItems = false, inputs: DashboardInputs = mockInputs, dashboardUid?: string) {
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
});
