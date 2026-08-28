import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { DashboardInteractions } from '../utils/interactions';

import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { type DashboardScene } from './DashboardScene';

export function AddControlsButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, viewPanel } = dashboard.useState();

  // The add flows are edit-only, so their implementations (variable type pane,
  // filter form, annotation actions, link pane) load on first use.
  const handleAddVariable = useCallback(async () => {
    const { openAddVariablePane } = await import(
      /* webpackChunkName: "dashboard-add-controls" */ '../settings/variables/VariableTypeSelectionPane'
    );
    openAddVariablePane(dashboard);
    DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  const handleAddFilter = useCallback(async () => {
    const { openAddFilterForm } = await import(
      /* webpackChunkName: "dashboard-add-controls" */ '../sidebar/add-new/AddFilters'
    );
    openAddFilterForm(dashboard, dashboard);
    DashboardInteractions.addFilterButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  const handleAddAnnotationQuery = useCallback(async () => {
    const dataLayers = sceneGraph.getData(dashboard);
    if (!(dataLayers instanceof DashboardDataLayerSet)) {
      return;
    }
    const { annotationEditActions } = await import(
      /* webpackChunkName: "dashboard-add-controls" */ '../settings/annotations/actions'
    );
    const newAnnotation = await dataLayers.createDefaultAnnotationLayer();
    annotationEditActions.addAnnotation({ source: dataLayers, addedObject: newAnnotation });
    DashboardInteractions.addAnnotationButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  const handleAddLink = useCallback(async () => {
    const { openAddLinkPane } = await import(
      /* webpackChunkName: "dashboard-add-controls" */ '../settings/links/LinkEdit'
    );
    openAddLinkPane(dashboard);
    DashboardInteractions.addLinkButtonClicked({ source: 'variable_controls' });
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
      <Menu.Item
        icon="comment-alt"
        label={t('dashboard.sidebar.add.annotation-query.label', 'Annotation query')}
        onClick={handleAddAnnotationQuery}
      />
      <Menu.Item icon="link" label={t('dashboard.sidebar.add.link.label', 'Link')} onClick={handleAddLink} />
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
            data-testid={selectors.components.ControlsAddButton.triggerButton}
            tooltip={t('dashboard-scene.dashboard-controls.add', 'Add')}
            aria-label={t('dashboard-scene.dashboard-controls.add', 'Add')}
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
