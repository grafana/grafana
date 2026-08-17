import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { openAddVariablePane } from '../settings/variables/VariableTypeSelectionPane';
import { openAddFilterForm } from '../sidebar/add-new/AddFilters';
import { DashboardInteractions } from '../utils/interactions';

import { type DashboardScene } from './DashboardScene';

export function AddVariableButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, viewPanel } = dashboard.useState();

  const handleAddVariable = useCallback(() => {
    openAddVariablePane(dashboard);
    DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  const handleAddFilter = useCallback(() => {
    openAddFilterForm(dashboard, dashboard);
    DashboardInteractions.addFilterButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  // Hide the button if:
  // - the dashboard is not in edit mode
  // - the dashboard is in an edit view mode
  // - the dashboard is in a view panel mode
  // - the dashboard is in an edit panel mode
  if (!isEditing || !!editview || !!viewPanel || !!editPanel) {
    return null;
  }

  const menu = (
    <Menu>
      <Menu.Item
        icon="gf-variable"
        label={t('dashboard.sidebar.add.variable.label', 'Variable')}
        onClick={handleAddVariable}
      />
      <Menu.Item
        icon="filter"
        label={t('dashboard.sidebar.add.filters.label', 'Filter and Group by')}
        onClick={handleAddFilter}
      />
    </Menu>
  );

  return (
    <div className={styles.addButton}>
      <div className="dashboard-canvas-add-button">
        <Dropdown overlay={menu} placement="bottom-start">
          <Button
            icon="plus"
            variant="secondary"
            fill="outline"
            size="md"
            tooltip={t('dashboard-scene.variable-controls.add-variable', 'Add variable')}
            aria-label={t('dashboard-scene.variable-controls.add-variable', 'Add variable')}
          />
        </Dropdown>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
