import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInput, DashboardInput, InputType } from 'app/features/manage-dashboards/state/reducers';

import { CommunityDashboardMappingForm } from './CommunityDashboardMappingForm';
import { CONTENT_KINDS, ContentKind, EVENT_LOCATIONS, EventLocation } from './interactions';
import { InputMapping } from './utils/autoMapDatasources';

interface CommunityDashboardMappingFormProps {
  dashboardName: string;
  libraryItemId: string;
  eventLocation: EventLocation;
  contentKind: ContentKind;
  datasourceTypes: string[];
  unmappedDsInputs: DataSourceInput[];
  constantInputs: DashboardInput[];
  existingMappings: InputMapping[];
  onBack: () => void;
  onPreview: (mappings: InputMapping[]) => void;
}

// Mock dependencies
jest.mock('./interactions', () => ({
  ...jest.requireActual('./interactions'),
  DashboardLibraryInteractions: {
    mappingFormShown: jest.fn(),
    mappingFormCompleted: jest.fn(),
  },
  CONTENT_KINDS: {
    COMMUNITY_DASHBOARD: 'community_dashboard',
  },
  EVENT_LOCATIONS: {
    MODAL_COMMUNITY_TAB: 'suggested_dashboards_modal_community_tab',
  },
  SOURCE_ENTRY_POINTS: {
    DATASOURCE_PAGE: 'datasource_page',
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn((uid: string) => ({
      uid,
      name: `DataSource ${uid}`,
      type: 'prometheus',
    })),
  }),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({
    onChange,
    placeholder,
  }: {
    onChange: (ds: { uid: string; name: string; type: string }) => void;
    placeholder?: string;
  }) => (
    <button onClick={() => onChange({ uid: 'test-ds-uid', name: 'Test DS', type: 'prometheus' })}>
      {placeholder}
    </button>
  ),
}));

// Helper functions
const createMockDataSourceInput = (overrides: Partial<DataSourceInput> = {}): DataSourceInput =>
  ({
    name: 'DS_PROMETHEUS',
    pluginId: 'prometheus',
    type: InputType.DataSource,
    label: 'Prometheus',
    value: '',
    info: 'Prometheus datasource',
    ...overrides,
  }) as DataSourceInput;

const createMockConstantInput = (overrides: Partial<DashboardInput> = {}): DashboardInput =>
  ({
    name: 'var_instance',
    type: InputType.Constant,
    label: 'Instance',
    value: 'default',
    description: 'Instance name',
    info: 'Instance name',
    pluginId: undefined,
    ...overrides,
  }) as DashboardInput;

const createMockExistingMapping = (overrides: Partial<InputMapping> = {}): InputMapping => ({
  name: 'DS_LOKI',
  type: 'datasource',
  pluginId: 'loki',
  value: 'loki-uid',
  ...overrides,
});

function renderForm(overrides: Partial<CommunityDashboardMappingFormProps> = {}) {
  const defaultProps: CommunityDashboardMappingFormProps = {
    dashboardName: 'Test Dashboard',
    libraryItemId: '123',
    eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
    contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
    datasourceTypes: ['prometheus'],
    unmappedDsInputs: [],
    constantInputs: [],
    existingMappings: [],
    onBack: jest.fn(),
    onPreview: jest.fn(),
    ...overrides,
  };

  return render(<CommunityDashboardMappingForm {...defaultProps} />);
}

function setupForm(overrides: Partial<CommunityDashboardMappingFormProps> = {}) {
  const defaultProps: CommunityDashboardMappingFormProps = {
    dashboardName: 'Test Dashboard',
    libraryItemId: '123',
    eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
    contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
    datasourceTypes: ['prometheus'],
    unmappedDsInputs: [],
    constantInputs: [],
    existingMappings: [],
    onBack: jest.fn(),
    onPreview: jest.fn(),
    ...overrides,
  };

  return {
    user: userEvent.setup(),
    ...render(<CommunityDashboardMappingForm {...defaultProps} />),
    props: defaultProps,
  };
}

describe('CommunityDashboardMappingForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render description text', () => {
      renderForm();

      expect(
        screen.getByText('This dashboard requires datasource configuration. Select datasources for each input below.')
      ).toBeInTheDocument();
    });

    it('should render back button', () => {
      renderForm();

      expect(screen.getByRole('button', { name: /back to dashboards/i })).toBeInTheDocument();
    });

    it('should render preview button', () => {
      renderForm();

      expect(screen.getByRole('button', { name: /preview dashboard/i })).toBeInTheDocument();
    });
  });

  describe('Auto-mapped datasources alert', () => {
    it('should show alert when existing mappings are provided', () => {
      renderForm({ existingMappings: [createMockExistingMapping()] });

      expect(screen.getByText(/1 datasources were automatically configured/i)).toBeInTheDocument();
      expect(screen.getByText(/loki → DataSource loki-uid/i)).toBeInTheDocument();
    });

    it('should not show alert when no existing mappings', () => {
      renderForm();

      expect(screen.queryByText(/datasources were automatically configured/i)).not.toBeInTheDocument();
    });
  });

  describe('Datasource inputs', () => {
    it('should render datasource configuration section when unmapped inputs exist', () => {
      renderForm({ unmappedDsInputs: [createMockDataSourceInput()] });

      expect(screen.getByText('Datasource Configuration')).toBeInTheDocument();
      expect(screen.getByText('Prometheus')).toBeInTheDocument();
    });

    it('should render multiple datasource inputs', () => {
      renderForm({
        unmappedDsInputs: [
          createMockDataSourceInput({ name: 'DS_PROM', label: 'Prometheus' }),
          createMockDataSourceInput({ name: 'DS_LOKI', label: 'Loki', pluginId: 'loki' }),
        ],
      });

      expect(screen.getByText('Prometheus')).toBeInTheDocument();
      expect(screen.getByText('Loki')).toBeInTheDocument();
    });

    it('should not render datasource section when no unmapped inputs', () => {
      renderForm();

      expect(screen.queryByText('Datasource Configuration')).not.toBeInTheDocument();
    });
  });

  describe('Constant inputs', () => {
    it('should render dashboard variables section when constant inputs exist', () => {
      renderForm({ constantInputs: [createMockConstantInput()] });

      expect(screen.getByText('Dashboard Variables')).toBeInTheDocument();
      expect(screen.getByText('Instance')).toBeInTheDocument();
    });

    it('should render input field with default value', () => {
      renderForm({ constantInputs: [createMockConstantInput({ value: 'my-default-value' })] });

      expect(screen.getByDisplayValue('my-default-value')).toBeInTheDocument();
    });

    it('should allow editing constant input values', async () => {
      const { user } = setupForm({ constantInputs: [createMockConstantInput()] });

      const input = screen.getByDisplayValue('default');
      await user.clear(input);
      await user.type(input, 'new-value');

      expect(screen.getByDisplayValue('new-value')).toBeInTheDocument();
    });

    it('should render multiple constant inputs', () => {
      renderForm({
        constantInputs: [
          createMockConstantInput({ name: 'var_instance', label: 'Instance' }),
          createMockConstantInput({ name: 'var_env', label: 'Environment', value: 'prod' }),
        ],
      });

      expect(screen.getByText('Instance')).toBeInTheDocument();
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('prod')).toBeInTheDocument();
    });
  });

  describe('Button interactions', () => {
    it('should call onBack when back button is clicked', async () => {
      const mockOnBack = jest.fn();
      const { user } = setupForm({ onBack: mockOnBack });

      await user.click(screen.getByRole('button', { name: /back to dashboards/i }));

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('should enable preview button when no unmapped datasources', () => {
      renderForm();

      expect(screen.getByRole('button', { name: /preview dashboard/i })).toBeEnabled();
    });

    it('should disable preview button when datasources are not mapped', () => {
      renderForm({ unmappedDsInputs: [createMockDataSourceInput()] });

      expect(screen.getByRole('button', { name: /preview dashboard/i })).toBeDisabled();
    });

    it('should enable preview button after all datasources are mapped', async () => {
      const { user } = setupForm({ unmappedDsInputs: [createMockDataSourceInput()] });

      expect(screen.getByRole('button', { name: /preview dashboard/i })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /prometheus datasource/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /preview dashboard/i })).toBeEnabled();
      });
    });

    it('should call onPreview with all mappings when preview is clicked', async () => {
      const mockOnPreview = jest.fn();
      const existingMappings = [createMockExistingMapping()];
      const { user } = setupForm({ onPreview: mockOnPreview, existingMappings });

      await user.click(screen.getByRole('button', { name: /preview dashboard/i }));

      expect(mockOnPreview).toHaveBeenCalledWith(existingMappings);
    });

    it('should call onPreview with combined mappings including constants', async () => {
      const mockOnPreview = jest.fn();
      const constantInputs = [createMockConstantInput({ name: 'var_test', value: 'test-value' })];
      const existingMappings = [createMockExistingMapping()];

      const { user } = setupForm({ onPreview: mockOnPreview, constantInputs, existingMappings });

      await user.click(screen.getByRole('button', { name: /preview dashboard/i }));

      expect(mockOnPreview).toHaveBeenCalledWith([
        ...existingMappings,
        { name: 'var_test', type: 'constant', value: 'test-value' },
      ]);
    });
  });
});
