// Libraries
import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<{ uid: string; panelId: string }> {}

export function PanelEditPage({ match }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { panelEditor, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadPanelEdit(match.params.uid, match.params.panelId);
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.uid, match.params.panelId]);

  if (!panelEditor) {
    return (
      <Page layout={PageLayoutType.Canvas}>
        {isLoading && <PageLoader />}
        {loadError && <h2>{loadError}</h2>}
      </Page>
    );
  }

  return <panelEditor.Component model={panelEditor} />;
}

export default PanelEditPage;
