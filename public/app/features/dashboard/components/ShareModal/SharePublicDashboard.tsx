import React, { useState, useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime/src';
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
    reportInteraction('grafana_dashboards_public_share_viewed');

    setDashboardVariables(props.dashboard.getVariables());
    getPublicDashboardConfig(dashboardUid, setPublicDashboardConfig).catch();
  }, [props, dashboardUid]);

  const onSavePublicConfig = () => {
    reportInteraction('grafana_dashboards_public_create_clicked');

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
          id="public-dashboard-enable-toggle"
          disabled={dashboardHasTemplateVariables(dashboardVariables)}
          value={publicDashboardConfig?.isPublic}
          onChange={() => {
            reportInteraction('grafana_dashboards_public_enable_clicked', {
              action: publicDashboardConfig?.isPublic ? 'disable' : 'enable',
            });

            setPublicDashboardConfig((state) => {
              return { ...state, isPublic: !state.isPublic };
            });
          }}
        />
      </Field>
      <Button onClick={onSavePublicConfig}>Save Sharing Configuration</Button>
    </>
  );
};
