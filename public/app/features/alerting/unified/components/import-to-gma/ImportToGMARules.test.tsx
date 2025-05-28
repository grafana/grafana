import { render, screen } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { alertingFactory } from '../../mocks/server/db';
import { testWithFeatureToggles } from '../../test/test-utils';

import ImportToGMARules from './ImportToGMARules';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

setupMswServer();

const ui = {
  importSource: {
    existingDatasource: byRole('radio', { name: /Import rules from existing data sources/ }),
    yaml: byRole('radio', { name: /Import rules from a Prometheus YAML file./ }),
  },
  dsImport: {
    dsPicker: byLabelText('Data source'),
    mimirDsOption: byRole('button', { name: /Mimir Prometheus$/ }),
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
};

alertingFactory.dataSource.mimir().build({ meta: { alerting: true } });

describe('ImportToGMARules', () => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleCreate]);
  testWithFeatureToggles(['alertingImportYAMLUI', 'alertingMigrationUI']);

  it('should render the import source options', () => {
    render(<ImportToGMARules />);

    expect(ui.importSource.existingDatasource.get()).toBeInTheDocument();
    expect(ui.importSource.yaml.get()).toBeInTheDocument();
  });

  describe('existing datasource', () => {
    it('should render datasource options', async () => {
      const { user } = render(<ImportToGMARules />);

      await user.click(ui.dsImport.dsPicker.get());
      await user.click(await ui.dsImport.mimirDsOption.find());

      expect(ui.dsImport.dsPicker.get()).toHaveProperty('placeholder', 'Mimir');
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
  });
});
