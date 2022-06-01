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
  DashboardResponse,
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
    // dashboard model may be stale, so load it ourselves
    getDashboard(dashboardUid)
      .then((dashboardResponse: DashboardResponse) => {
        setDashboard(new DashboardModel(dashboardResponse.dashboard, dashboardResponse.meta));
      })
      .catch((err) => {
        dispatch(notifyApp(createErrorNotification('Failed to retrieve dashboard', err)));
      });

    // load config
    getPublicDashboardConfig(dashboardUid)
      .then((pdc: PublicDashboardConfig) => {
        setPublicDashboardConfig(pdc);
      })
      .catch((err) => {
        dispatch(notifyApp(createErrorNotification('Failed to retrieve public dashboard config', err)));
      });
  }, [dashboardUid]);

  const onSavePublicConfig = () => {
    if (!dashboardCanBePublic(dashboard)) {
      dispatch(notifyApp(createErrorNotification('This dashboard cannot be made public')));
      return;
    }

    savePublicDashboardConfig(props.dashboard.uid, publicDashboardConfig)
      .then((pdc: PublicDashboardConfig) => {
        setPublicDashboardConfig(pdc);
        dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
      })
      .catch((err) => {
        console.error('Error while making dashboard public', err);
        dispatch(notifyApp(createErrorNotification('Error making dashboard public')));
      });
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
