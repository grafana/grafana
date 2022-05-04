import React, { useState } from 'react';

import { Button, Field, Switch } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { dashboardCanBePublic, savePublicConfig, SharingConfiguration } from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

// 1. write test for dashboardCanBePublic
// 2. figure out how to disable the switch

export const SharePublicDashboard = (props: Props) => {
  const [isPublic, setIsPublic] = useState(props.dashboard.meta.isPublic ?? false);

  const onSavePublicConfig = () => {
    // verify dashboard can be public
    if (dashboardCanBePublic(props.dashboard)) {
      dispatch(notifyApp(createErrorNotification('This dashboard cannot be made public')));
      return;
    }

    savePublicConfig({
      isPublic: isPublic,
      dashboardUid: props.dashboard.uid,
    } as SharingConfiguration);
  };

  return (
    <>
      <p className="share-modal-info-text">Public Dashboard Configuration</p>
      <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
        <Switch
          id="share-current-time-range"
          disabled={dashboardCanBePublic(props.dashboard)}
          value={isPublic}
          onChange={() => setIsPublic(!isPublic)}
        />
      </Field>
      <Button onClick={onSavePublicConfig}>Save Sharing Configuration</Button>
    </>
  );
};
