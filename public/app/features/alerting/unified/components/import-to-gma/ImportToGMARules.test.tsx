import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { alertingFactory } from '../../mocks/server/db';

import ImportToGMARules from './ImportToGMARules';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return { ...actual, getDataSourceInstanceList: jest.fn(actual.getDataSourceInstanceList) };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const listMock = jest.mocked(getDataSourceInstanceList);

// Holds the recording rules target discovery until the test releases it.
function holdRecordingTargetDiscovery() {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  listMock.mockImplementation(async (filters) => {
    await released;
    return runtime.getDataSourceInstanceList(filters);
  });
  return release;
}

const ui = {
  importSource: {
    existingDatasource: byRole('radio', { name: /Import rules from existing data sources/ }),
    yaml: byRole('radio', { name: /Import rules from a Prometheus YAML file./ }),
  },
  dsImport: {
    dsPicker: byLabelText(/data source/i, { selector: '#datasource-picker' }),
    mimirDsOption: byRole('option', { name: /Mimir$/ }),
  },
  yamlImport: {
    fileUpload: byLabelText('Upload file'),
    targetDataSource: byLabelText(/Target data source/, { selector: '#yaml-target-data-source' }),
  },
  additionalSettings: {
    targetFolder: byRole('button', { name: /Select folder/ }),
    namespaceFilter: byRole('combobox', { name: /^Namespace/ }),
    ruleGroupFilter: byRole('combobox', { name: /^Group/ }),
    // There is a bug affecting using byRole selector. The bug has been fixed but we use older version of the library.
    // https://github.com/testing-library/dom-testing-library/issues/1101#issuecomment-2001928377
    pauseAlertingRules: byLabelText('Pause imported alerting rules', { selector: '#pause-alerting-rules' }),
    pauseRecordingRules: byLabelText('Pause imported recording rules', { selector: '#pause-recording-rules' }),
    targetDataSourceForRecording: byLabelText(/Target data source/, {
      selector: '#recording-rules-target-data-source',
    }),
  },
  importButton: byRole('button', { name: /Import/ }),
  confirmationModal: byRole('dialog', { name: /Confirm import/ }),
};

alertingFactory.dataSource.mimir().build({ meta: { alerting: true } });

describe('ImportToGMARules', () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleCreate]);
  testWithFeatureToggles({ enable: ['alertingImportYAMLUI', 'alertingMigrationUI'] });

  afterEach(() => {
    listMock.mockImplementation(runtime.getDataSourceInstanceList);
  });

  it('should render the import source options', async () => {
    render(<ImportToGMARules />);

    expect(ui.importSource.existingDatasource.get()).toBeInTheDocument();
    expect(ui.importSource.yaml.get()).toBeInTheDocument();
    await waitFor(() => expect(ui.additionalSettings.targetDataSourceForRecording.get()).toBeEnabled());
  });

  describe('recording rules target', () => {
    it('disables the YAML target and recording target pickers until the valid targets are known', async () => {
      const releaseDiscovery = holdRecordingTargetDiscovery();
      const { user } = render(<ImportToGMARules />);
      await user.click(ui.importSource.yaml.get());

      expect(await ui.yamlImport.targetDataSource.find()).toBeDisabled();
      expect(ui.additionalSettings.targetDataSourceForRecording.get()).toBeDisabled();

      releaseDiscovery();

      await waitFor(() => expect(ui.additionalSettings.targetDataSourceForRecording.get()).toBeEnabled());
      expect(ui.yamlImport.targetDataSource.get()).toBeEnabled();
    });

    it('shows an error on the recording target field when the valid targets cannot be loaded', async () => {
      listMock.mockRejectedValue(new Error('list request failed'));
      render(<ImportToGMARules />);

      expect(
        await screen.findByText('Failed to load the list of data sources that can store recording rules')
      ).toBeInTheDocument();
    });
  });

  describe('existing datasource', () => {
    it('should render datasource options', async () => {
      const { user } = render(<ImportToGMARules />);

      // Wait for the data source picker to be ready and enabled
      const dsPicker = await ui.dsImport.dsPicker.find();
      await waitFor(() => expect(dsPicker).toBeEnabled());

      await user.click(dsPicker);
      await user.click(await ui.dsImport.mimirDsOption.find());

      expect(await ui.dsImport.dsPicker.find()).toHaveProperty('placeholder', 'Mimir');
    });

    it('should render additional options', async () => {
      render(<ImportToGMARules />);

      // Test that all additional option fields are visible
      expect(await ui.additionalSettings.targetFolder.find()).toBeInTheDocument();
      expect(ui.additionalSettings.namespaceFilter.get()).toBeDisabled();
      expect(ui.additionalSettings.ruleGroupFilter.get()).toBeDisabled();
      expect(ui.additionalSettings.targetDataSourceForRecording.get()).toBeInTheDocument();

      // // Test default values for pause switches (both should be checked by default)
      expect(ui.additionalSettings.pauseAlertingRules.get()).toBeChecked();
      expect(ui.additionalSettings.pauseRecordingRules.get()).toBeChecked();

      expect(ui.yamlImport.fileUpload.query()).not.toBeInTheDocument();
      expect(ui.yamlImport.targetDataSource.query()).not.toBeInTheDocument();
    });

    it('should show confirmation dialog when importing from data source', async () => {
      const { user } = render(<ImportToGMARules />);

      // Wait for the data source picker to be enabled
      const dsPicker = ui.dsImport.dsPicker.get();
      await waitFor(() => expect(dsPicker).toBeEnabled());

      // Select a data source
      await user.click(dsPicker);
      await user.click(await ui.dsImport.mimirDsOption.find());

      // Click the import button
      await user.click(ui.importButton.get());

      // Verify confirmation dialog appears
      expect(await ui.confirmationModal.find()).toBeInTheDocument();
    });
  });

  describe('yaml import', () => {
    it('should render the yaml import options', async () => {
      const { user } = render(<ImportToGMARules />);

      // Select YAML import option
      await user.click(ui.importSource.yaml.get());

      // Test that YAML-specific fields are visible
      expect(await ui.yamlImport.fileUpload.find()).toBeInTheDocument();
      expect(ui.yamlImport.targetDataSource.get()).toBeInTheDocument();

      // Test that pause switches are checked by default
      expect(ui.additionalSettings.pauseAlertingRules.get()).toBeChecked();
      expect(ui.additionalSettings.pauseRecordingRules.get()).toBeChecked();

      // Test that datasource-specific field is not visible
      expect(ui.dsImport.dsPicker.query()).not.toBeInTheDocument();
    });

    it('should show confirmation dialog when importing YAML file', async () => {
      const { user } = render(<ImportToGMARules />);

      // Select YAML import option
      await user.click(ui.importSource.yaml.get());

      // Create a simple YAML file
      const yamlContent = `
groups:
  - name: example
    rules:
      - alert: HighRequestLatency
        expr: http_request_duration_seconds > 0.5
        for: 10m
        labels:
          severity: page
        annotations:
          summary: High request latency
`;
      const file = new File([yamlContent], 'test-rules.yaml', { type: 'application/x-yaml' });

      // Upload the file
      const fileInput = ui.yamlImport.fileUpload.get();
      await user.upload(fileInput, file);

      // Select target data source
      await user.click(ui.yamlImport.targetDataSource.get());
      await user.click(await ui.dsImport.mimirDsOption.find());

      // Click the import button
      await user.click(ui.importButton.get());

      // Verify confirmation dialog appears
      expect(await ui.confirmationModal.find()).toBeInTheDocument();
    });
  });
});
