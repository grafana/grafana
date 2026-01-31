import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { defaultSpec, Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Form } from 'app/core/components/Form/Form';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { DashboardInputs, InputType } from 'app/features/manage-dashboards/state/reducers';

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

jest.mock('app/features/manage-dashboards/utils/validation', () => ({
  validateTitle: jest.fn().mockResolvedValue(true),
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

  type FormData = SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string };

  function renderForm(hasFloatGridItems = false, inputs: DashboardInputs = mockInputs) {
    return render(
      <Form<FormData> onSubmit={mockOnSubmit} defaultValues={{ dashboard: defaultSpec(), folderUid: 'test-folder' }}>
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
});
