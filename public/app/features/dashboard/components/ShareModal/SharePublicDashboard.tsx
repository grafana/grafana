import React, { useState } from 'react';

import { Button, Field, Switch } from '@grafana/ui';

import { savePublicConfig, SharingConfiguration } from './SharePublicUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

// TODO:
// loading existing dashboard sharing state

export const SharePublicDashboard = (props: Props) => {
  const [isPublic, setIsPublic] = useState(props.dashboard.meta.isPublic ?? false);

  const onSavePublicConfig = () => {
    savePublicConfig({
      isPublic: isPublic,
      dashboardUid: props.dashboard.uid,
    } as SharingConfiguration);
  };

  return (
    <>
      <p className="share-modal-info-text">Sharing for your dashboard</p>
      <Field label="Dashboard is Public" description="Configures whether current dashboard is available publicly">
        <Switch id="share-current-time-range" value={isPublic} onChange={() => setIsPublic(!isPublic)} />
      </Field>
      <Button onClick={onSavePublicConfig}>Save Sharing Configuration</Button>
    </>
  );
};
