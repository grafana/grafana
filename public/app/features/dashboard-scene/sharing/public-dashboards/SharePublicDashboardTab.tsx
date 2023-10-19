import React from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { Loader } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import {
  PublicDashboard,
  publicDashboardPersisted,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../../scene/DashboardScene';
import { SceneShareTabState } from '../types';

import { ConfigPublicDashboard } from './ConfigPublicDashboard';
import { CreatePublicDashboard } from './CreatePublicDashboard';

export interface SharePublicDashboardTabState extends SceneShareTabState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  isGetLoading: boolean;
  isUpdateLoading?: boolean;
  isSaveLoading?: boolean;
  publicDashboard?: PublicDashboard;
}

export class SharePublicDashboardTab extends SceneObjectBase<SharePublicDashboardTabState> {
  static Component = SharePublicDashboardTabRenderer;

  public constructor(state: SharePublicDashboardTabState) {
    super({
      ...state,
      isGetLoading: false,
      isUpdateLoading: false,
      isSaveLoading: false,
    });

    this.addActivationHandler(() => {
      this._onActivate();
    });
  }

  private _onActivate() {
    this.onGet();
  }

  public getTabLabel() {
    return t('share-modal.tab-title.public-dashboard', 'Public Dashboard');
  }

  public onGet = async () => {
    const { dashboardRef } = this.state;
    const dash = dashboardRef.resolve();

    this.setState({ isGetLoading: true });
    try {
      const publicDashboard = await getBackendSrv().get(
        `/api/dashboards/uid/${dash.state.uid}/public-dashboards`,
        undefined,
        undefined,
        { showErrorAlert: false }
      );
      this.setState({
        publicDashboard,
      });
    } finally {
      this.setState({ isGetLoading: false });
    }
  };

  public onCreate = async () => {
    const { dashboardRef } = this.state;
    const dash = dashboardRef.resolve();

    try {
      this.setState({ isSaveLoading: true });
      const results: { uid: string; isEnabled: boolean } = await getBackendSrv().post(
        `/api/dashboards/uid/${dash.state.uid}/public-dashboards`,
        { isEnabled: true }
      );
      this.onGet();
      dash.setState({
        meta: { ...dash.state.meta, publicDashboardUid: results.uid, publicDashboardEnabled: results.isEnabled },
      });
    } finally {
      this.setState({ isSaveLoading: false });
      trackDashboardSharingActionPerType('generate_public_url', shareDashboardType.publicDashboard);
    }
  };

  public onUpdate = async (payload: Partial<PublicDashboard>) => {
    const { dashboardRef, publicDashboard } = this.state;
    const dash = dashboardRef.resolve();

    const { uid, isEnabled }: { uid: string; isEnabled: boolean } = await getBackendSrv().patch(
      `/api/dashboards/uid/${dash.state.uid}/public-dashboards/${publicDashboard?.uid}`,
      payload
    );
    dash.setState({ meta: { ...dash.state.meta, publicDashboardEnabled: isEnabled, publicDashboardUid: uid } });
    this.setState({ publicDashboard: { ...publicDashboard!, ...payload } });
  };

  public onDelete = async () => {
    const { dashboardRef, publicDashboard } = this.state;
    const dash = dashboardRef.resolve();

    await getBackendSrv().delete(`/api/dashboards/uid/${dash.state.uid}/public-dashboards/${publicDashboard?.uid}`);
    dash.setState({
      meta: {
        ...dash.state.meta,
        publicDashboardUid: publicDashboard?.uid,
        publicDashboardEnabled: false,
      },
    });
  };
}

function SharePublicDashboardTabRenderer({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { isGetLoading, publicDashboard } = model.useState();

  return (
    <>
      {isGetLoading ? (
        <Loader />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard model={model} />
      ) : (
        <ConfigPublicDashboard model={model} />
      )}
    </>
  );
}
