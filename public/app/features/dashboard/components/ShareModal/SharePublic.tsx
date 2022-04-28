import React, { useState } from 'react';
import { Button, Field, Switch } from '@grafana/ui';
//import { AppEvents, SelectableValue } from '@grafana/data';
//import { appEvents } from 'app/core/core';
import { ShareModalTabProps } from './types';
import { savePublicConfig, SharingConfiguration } from './SharePublicUtils';

interface Props extends ShareModalTabProps {}

// TODO:
// loading existing dashboard sharing state
// put existing dashboard state into react component state

// export class SharePublic extends PureComponent<Props, State> {
const SharePublic = (props: Props) => {
  const [isPublic, setIsPublic] = useState(false);

  const onSavePublicConfig = () => {
    savePublicConfig({
      isPublic,
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

export default SharePublic;
