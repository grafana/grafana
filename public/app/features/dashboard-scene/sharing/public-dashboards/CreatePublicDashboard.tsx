import { css } from '@emotion/css';
import React from 'react';
import { FormState, UseFormRegister } from 'react-hook-form';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { DataSourceWithBackend } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneDataTransformer,
  SceneGridItem,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Button, Form, Spinner, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AcknowledgeCheckboxes } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/AcknowledgeCheckboxes';
import { SharePublicDashboardAcknowledgmentInputs } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';
import { NoUpsertPermissionsAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { UnsupportedDataSourcesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedTemplateVariablesAlert';
import { supportedDatasources } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SupportedPubdashDatasources';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AccessControlAction } from 'app/types';

import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryVizPanel } from '../../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../../scene/PanelRepeaterGridItem';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { isSaveLoading: isLoading, dashboardRef } = model.useState();

  const styles = useStyles2(getStyles);
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const dashboard = dashboardRef.resolve();
  const { value: unsupportedDataSources } = useAsync(async () => {
    const types = getPanelTypes(dashboard);
    return getUnsupportedDashboardDatasources(types);
  }, []);

  const disableInputs = !hasWritePermissions || !!isLoading;
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <div className={styles.container}>
      <div>
        <p className={styles.title}>Welcome to public dashboards!</p>
        <p className={styles.description}>
          Currently, we don&apos;t support template variables or frontend data sources
        </p>
      </div>

      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="create" />}

      {hasTemplateVariables && <UnsupportedTemplateVariablesAlert />}

      {unsupportedDataSources?.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}

      <Form onSubmit={model.onCreate} validateOn="onChange" maxWidth="none">
        {({
          register,
          formState: { isValid },
        }: {
          register: UseFormRegister<SharePublicDashboardAcknowledgmentInputs>;
          formState: FormState<SharePublicDashboardAcknowledgmentInputs>;
        }) => (
          <>
            <div className={styles.checkboxes}>
              <AcknowledgeCheckboxes disabled={disableInputs} register={register} />
            </div>
            <div className={styles.buttonContainer}>
              <Button type="submit" disabled={disableInputs || !isValid} data-testid={selectors.CreateButton}>
                Generate public URL {isLoading && <Spinner className={styles.loadingSpinner} />}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  );
}

function getPanelTypes(scene: DashboardScene): string[] {
  const types = new Set<string>();

  const body = scene.state.body;
  if (!(body instanceof SceneGridLayout)) {
    return [];
  }

  for (const child of body.state.children) {
    if (child instanceof SceneGridItem) {
      const ts = panelTypes(child);
      for (const t of ts) {
        types.add(t);
      }
    }

    if (child instanceof SceneGridRow) {
      const ts = rowTypes(child);
      for (const t of ts) {
        types.add(t);
      }
    }
  }

  return Array.from(types).sort();
}

export function panelTypes(gridItem: SceneGridItemLike) {
  let vizPanel: VizPanel | undefined;
  if (gridItem instanceof SceneGridItem) {
    if (gridItem.state.body instanceof LibraryVizPanel) {
      vizPanel = gridItem.state.body.state.panel;
    } else if (gridItem.state.body instanceof VizPanel) {
      vizPanel = gridItem.state.body;
    } else {
      throw new Error('SceneGridItem body expected to be VizPanel');
    }
  } else if (gridItem instanceof PanelRepeaterGridItem) {
    vizPanel = gridItem.state.source;
  }

  if (!vizPanel) {
    throw new Error('Unsupported grid item type');
  }
  const dataProvider = vizPanel.state.$data;
  const types = new Set<string>();
  if (dataProvider instanceof SceneQueryRunner) {
    for (const q of dataProvider.state.queries) {
      types.add(q.datasource?.type ?? '');
    }
  }

  if (dataProvider instanceof SceneDataTransformer) {
    const panelData = dataProvider.state.$data;
    if (panelData instanceof SceneQueryRunner) {
      for (const q of panelData.state.queries) {
        types.add(q.datasource?.type ?? '');
      }
    }
  }

  return Array.from(types);
}

function rowTypes(gridRow: SceneGridRow) {
  const types = new Set(gridRow.state.children.map((c) => panelTypes(c)).flat());
  return types;
}

export const getUnsupportedDashboardDatasources = async (types: string[]): Promise<string[]> => {
  let unsupportedDS = new Set<string>();

  for (const type of types) {
    if (!supportedDatasources.has(type)) {
      unsupportedDS.add(type);
    } else {
      const ds = await getDatasourceSrv().get(type);
      if (!(ds instanceof DataSourceWithBackend)) {
        unsupportedDS.add(type);
      }
    }
  }

  return Array.from(unsupportedDS);
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  }),
  title: css({
    fontSize: theme.typography.h4.fontSize,
    margin: theme.spacing(0, 0, 2),
  }),
  description: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0),
  }),
  checkboxes: css({
    margin: theme.spacing(0, 0, 4),
  }),
  buttonContainer: css({
    display: 'flex',
    justifyContent: 'end',
  }),
  loadingSpinner: css({
    marginLeft: theme.spacing(1),
  }),
});
