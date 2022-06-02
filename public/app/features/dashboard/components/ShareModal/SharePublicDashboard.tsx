import React, { useState, useEffect } from 'react';

import { Button, Field, Switch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { dispatch } from 'app/store/store';

import {
  dashboardCanBePublic,
  getPublicDashboardConfig,
  savePublicDashboardConfig,
  getDashboard,
  PublicDashboardConfig,
} from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

export const SharePublicDashboard = (props: Props) => {
  const dashboardUid = props.dashboard.uid;
  const orgId = contextSrv.user.orgId;
  const [publicDashboardConfig, setPublicDashboardConfig] = useState<PublicDashboardConfig>({
    isPublic: false,
    publicDashboard: { uid: '', dashboardUid, orgId },
  });

  const [dashboard, setDashboard] = useState<DashboardModel>({} as DashboardModel);

  useEffect(() => {
    // dashboard model may be stale, get a fresh copy
    getDashboard(dashboardUid, setDashboard).catch();
    getPublicDashboardConfig(dashboardUid, setPublicDashboardConfig).catch();
  }, [dashboardUid]);

  const onSavePublicConfig = () => {
    if (!dashboardCanBePublic(dashboard)) {
      dispatch(
        notifyApp(createErrorNotification('This dashboard cannot be made public because it has template variables'))
      );
      return;
    }

    savePublicDashboardConfig(dashboard.uid, publicDashboardConfig, setPublicDashboardConfig).catch();
  };

  return (
    <>
      {!dashboardCanBePublic(dashboard) && (
        <Alert severity="warning" title="dashboard cannot be public">
          This dashboard cannot be made public because it has template variables
        </Alert>
      )}

      <p className="share-modal-info-text">Public Dashboard Configuration</p>

      <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
        <Switch
          id="share-current-time-range"
          disabled={!dashboardCanBePublic(dashboard)}
          value={publicDashboardConfig?.isPublic}
          onChange={() =>
            setPublicDashboardConfig((state) => {
              return { ...state, isPublic: !state.isPublic };
            })
          }
        />
      </Field>
      <Button onClick={onSavePublicConfig}>Save Sharing Configuration</Button>
    </>
  );
};
