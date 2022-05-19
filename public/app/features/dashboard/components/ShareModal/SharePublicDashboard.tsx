import React, { useState, useEffect } from 'react';

import { Button, Field, Switch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { dispatch } from 'app/store/store';

import {
  dashboardCanBePublic,
  getPublicDashboardConfig,
  savePublicDashboardConfig,
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

  useEffect(() => {
    getPublicDashboardConfig(dashboardUid)
      .then((pdc: PublicDashboardConfig) => {
        // empty uid means there isn't a public dashboard entry yet
        if (pdc.publicDashboard.dashboardUid === '') {
          pdc.publicDashboard.dashboardUid = dashboardUid;
          pdc.publicDashboard.orgId = orgId;
        }
        setPublicDashboardConfig(pdc);
      })
      .catch(() => {
        dispatch(notifyApp(createErrorNotification('Failed to retrieve public dashboard config')));
      });
  }, [dashboardUid, orgId]);

  const onSavePublicConfig = () => {
    if (!dashboardCanBePublic(props.dashboard)) {
      dispatch(notifyApp(createErrorNotification('This dashboard cannot be made public')));
      return;
    }

    try {
      savePublicDashboardConfig(props.dashboard.uid, publicDashboardConfig);
      dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
    } catch (err) {
      console.error('Error while making dashboard public', err);
      dispatch(notifyApp(createErrorNotification('Error making dashboard public')));
    }
  };

  return (
    <>
      {!dashboardCanBePublic(props.dashboard) && (
        <Alert severity="warning" title="dashboard cannot be public">
          This dashboard cannot be made public because it has template variables
        </Alert>
      )}

      <p className="share-modal-info-text">Public Dashboard Configuration</p>

      <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
        <Switch
          id="share-current-time-range"
          disabled={!dashboardCanBePublic(props.dashboard)}
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
