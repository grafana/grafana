import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { isFullDashboardEditing } from 'app/features/dashboard-scene/scene/types/dashboard';

import { DashboardInteractions } from '../utils/interactions';

import { useCanEditQuestions } from './DashboardControlsExtensionPoint';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { type DashboardScene } from './DashboardScene';

export function AddControlsButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const dashboardState = dashboard.useState();
  const { editview, editPanel, viewPanel } = dashboardState;
  const isEditing = isFullDashboardEditing(dashboardState);
  const canAddQuestion = useCanEditQuestions(dashboard);

  // The add flows are edit-only, so their implementations (variable type pane,
  // filter form, annotation actions, link pane) load on first use.
  const handleAddVariable = useCallback(async () => {
    await dashboard.state.sidebar.runPaneRequest(async (signal) => {
      const { openAddVariablePane } = await import(
        /* webpackChunkName: "dashboard-add-controls" */ '../settings/variables/VariableTypeSelectionPane'
      );
      if (signal.aborted) {
        return;
      }
      openAddVariablePane(dashboard);
      DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
    });
  }, [dashboard]);

  const handleAddFilter = useCallback(async () => {
    await dashboard.state.sidebar.runPaneRequest(async (signal) => {
      const { openAddFilterForm } = await import(
        /* webpackChunkName: "dashboard-add-controls" */ '../sidebar/add-new/AddFilters'
      );
      if (signal.aborted) {
        return;
      }
      await openAddFilterForm(dashboard, dashboard, signal);
      DashboardInteractions.addFilterButtonClicked({ source: 'variable_controls' });
    });
  }, [dashboard]);

  const handleAddAnnotationQuery = useCallback(async () => {
    await dashboard.state.sidebar.runPaneRequest(async (signal) => {
      const dataLayers = sceneGraph.getData(dashboard);
      if (!(dataLayers instanceof DashboardDataLayerSet)) {
        return;
      }
      const { annotationEditActions } = await import(
        /* webpackChunkName: "dashboard-add-controls" */ '../settings/annotations/actions'
      );
      const newAnnotation = await dataLayers.createDefaultAnnotationLayer();
      if (signal.aborted) {
        return;
      }
      annotationEditActions.addAnnotation({ source: dataLayers, addedObject: newAnnotation });
      DashboardInteractions.addAnnotationButtonClicked({ source: 'variable_controls' });
    });
  }, [dashboard]);

  const handleAddLink = useCallback(async () => {
    await dashboard.state.sidebar.runPaneRequest(async (signal) => {
      const { openAddLinkPane } = await import(
        /* webpackChunkName: "dashboard-add-controls" */ '../settings/links/LinkAddEditableElement'
      );
      if (signal.aborted) {
        return;
      }
      openAddLinkPane(dashboard);
      DashboardInteractions.addLinkButtonClicked({ source: 'variable_controls' });
    });
  }, [dashboard]);

  const handleAddQuestion = useCallback(async () => {
    await dashboard.state.sidebar.runPaneRequest(async (signal) => {
      const { openAddQuestionPane } = await import(
        /* webpackChunkName: "dashboard-add-controls" */ '../sidebar/questions/QuestionEdit'
      );
      if (signal.aborted) {
        return;
      }
      openAddQuestionPane(dashboard, 'dashboard');
    });
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
      {canAddQuestion && (
        <Menu.Item
          icon="ai-sparkle"
          label={t('dashboard.sidebar.add.question.label', 'Question')}
          onClick={handleAddQuestion}
        />
      )}
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
