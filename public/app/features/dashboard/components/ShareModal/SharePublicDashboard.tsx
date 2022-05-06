import React, { useState, useEffect } from 'react';

import { Button, Field, Switch } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import {
  dashboardCanBePublic,
  getPublicDashboardConfig,
  savePublicDashboardConfig,
  PublicDashboardConfig,
} from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

// 1. write test for dashboardCanBePublic
// 2. figure out how to disable the switch

export const SharePublicDashboard = (props: Props) => {
  const [publicDashboardConfig, setPublicDashboardConfig] = useState<PublicDashboardConfig>({ isPublic: false });
  const dashboardUid = props.dashboard.uid;

  useEffect(() => {
    getPublicDashboardConfig(dashboardUid)
      .then((pdc: PublicDashboardConfig) => {
        setPublicDashboardConfig(pdc);
      })
      .catch(() => {
        dispatch(notifyApp(createErrorNotification('Failed to retrieve public dashboard config')));
      });
  }, [dashboardUid]);

  const onSavePublicConfig = () => {
    // verify dashboard can be public
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
