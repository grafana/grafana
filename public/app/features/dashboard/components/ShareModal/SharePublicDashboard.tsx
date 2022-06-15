import React, { useState, useEffect } from 'react';

import { Button, Field, Switch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { VariableModel } from 'app/features/variables/types';
import { dispatch } from 'app/store/store';

import {
  dashboardHasTemplateVariables,
  getPublicDashboardConfig,
  savePublicDashboardConfig,
  PublicDashboardConfig,
} from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

export const SharePublicDashboard = (props: Props) => {
  const dashboardUid = props.dashboard.uid;
  const [publicDashboardConfig, setPublicDashboardConfig] = useState<PublicDashboardConfig>({
    isPublic: false,
    publicDashboard: { uid: '', dashboardUid },
  });

  const [dashboardVariables, setDashboardVariables] = useState<VariableModel[]>([]);

  useEffect(() => {
    setDashboardVariables(props.dashboard.getVariables());
    getPublicDashboardConfig(dashboardUid, setPublicDashboardConfig).catch();
  }, [props, dashboardUid]);

  const onSavePublicConfig = () => {
    if (dashboardHasTemplateVariables(dashboardVariables)) {
      dispatch(
        notifyApp(createErrorNotification('This dashboard cannot be made public because it has template variables'))
      );
      return;
    }

    savePublicDashboardConfig(props.dashboard.uid, publicDashboardConfig, setPublicDashboardConfig).catch();
  };

  return (
    <>
      {dashboardHasTemplateVariables(dashboardVariables) && (
        <Alert severity="warning" title="dashboard cannot be public">
          This dashboard cannot be made public because it has template variables
        </Alert>
      )}

      <p className="share-modal-info-text">Public Dashboard Configuration</p>

      <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
        <Switch
          id="share-current-time-range"
          disabled={dashboardHasTemplateVariables(dashboardVariables)}
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
