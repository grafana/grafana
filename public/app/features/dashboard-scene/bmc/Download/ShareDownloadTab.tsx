import { Suspense, lazy } from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { ShareView } from '../../sharing/types';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { PanelModelCompatibilityWrapper } from '../../utils/PanelModelCompatibilityWrapper';
import { getDashboardSceneFor } from '../../utils/utils';

const ExportUtility = lazy(
  () => import(/* webpackChunkName: "ExportUtility" */ '../../../dashboard/components/ShareModal/ExportUtility')
);
export interface ShareDownloadTabState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
  onDismiss?: () => void;
}

export class ShareDownloadTab extends SceneObjectBase<ShareDownloadTabState> implements ShareView {
  public tabId = shareDashboardType.download;
  static Component = ShareDownloadTabRenderer;

  public constructor(state: {
    panelRef?: SceneObjectRef<VizPanel>;
    dashboardRef: SceneObjectRef<DashboardScene>;
    onDismiss?: () => void;
  }) {
    super({
      ...state,
    });
  }

  public getTabLabel() {
    return t('bmc.common.download', 'Download');
  }
}
class DashboardAdapterForExportUtility extends DashboardModelCompatibilityWrapper {
  constructor(private _dashboardScene: DashboardScene) {
    super(_dashboardScene);
  }

  getVariables() {
    return (this._dashboardScene.state.$variables?.state.variables || []).map((v) => {
      return { ...v.state };
    });
  }
}

const renderLoader = () => {
  return (
    <div className="preloader">
      <LoadingPlaceholder text={t('bmc.share-modal.loading', 'Loading') + '...'} />
    </div>
  );
};

function ShareDownloadTabRenderer({ model }: SceneComponentProps<ShareDownloadTab>) {
  const { panelRef, onDismiss } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const panel = panelRef?.resolve();
  const dashboardAdapter = new DashboardAdapterForExportUtility(dashboard);
  const panelAdapter = panel ? new PanelModelCompatibilityWrapper(panel) : undefined;

  const classNameWrapper = 'flex-grow-1';
  const selectWidth = undefined;
  return (
    <Suspense fallback={renderLoader()}>
      <ExportUtility
        dashboard={dashboardAdapter as any}
        panel={panelAdapter as any}
        onDismiss={onDismiss}
        isScene={true}
        classNameWrapper={classNameWrapper}
        selectWidth={selectWidth}
      />
    </Suspense>
  );
}
