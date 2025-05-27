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
    fileUpload: byLabelText('Prometheus YAML file'),
    targetDataSource: byLabelText('Target data source'),
  },
  additionalSettings: {
    collapseButton: byRole('button', { name: /Additional settings/ }),
    targetFolder: byRole('button', { name: /Select folder/ }),
    namespaceFilter: byRole('combobox', { name: /^Namespace/ }),
    ruleGroupFilter: byRole('combobox', { name: /^Group/ }),
    pauseAlertingRules: byLabelText('Pause imported alerting rules'),
    pauseRecordingRules: byLabelText('Pause imported recording rules'),
    targetDataSourceForRecording: byLabelText(/Target data source/),
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
      expect(await ui.additionalSettings.namespaceFilter.find()).toBeDisabled();
      expect(await ui.additionalSettings.ruleGroupFilter.find()).toBeDisabled();
      // expect(await ui.additionalSettings.pauseAlertingRules.find()).toBeInTheDocument();
      // expect(await ui.additionalSettings.pauseRecordingRules.find()).toBeInTheDocument();
      expect(await ui.additionalSettings.targetDataSourceForRecording.find()).toBeInTheDocument();

      // // Test default values for pause switches (both should be checked by default)
      expect(ui.additionalSettings.pauseAlertingRules.get()).toBeChecked();
      expect(ui.additionalSettings.pauseRecordingRules.get()).toBeChecked();
    });
  });

  describe('yaml import', () => {
    it('should render the yaml import options', async () => {
      const { user } = render(<ImportToGMARules />);

      // Select YAML import option
      await user.click(ui.importSource.yaml.get());

      // Test that YAML-specific fields are visible
      expect(ui.yamlImport.fileUpload.get()).toBeInTheDocument();
      expect(ui.yamlImport.targetDataSource.get()).toBeInTheDocument();

      // Test that datasource-specific field is not visible
      expect(ui.dsImport.dsPicker.query()).not.toBeInTheDocument();
    });
  });
});
