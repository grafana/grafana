import React, { PureComponent } from 'react';
import { Field, Switch, Button } from '@grafana/ui';
//import { AppEvents, SelectableValue } from '@grafana/data';
//import { appEvents } from 'app/core/core';
import { ShareModalTabProps } from './types';
import { savePublicConfig, SharingConfiguration } from './SharePublicUtils';

interface Props extends ShareModalTabProps {}

interface State {
  isPublic: boolean;
}

// TODO:
// loading existing dashboard sharing state
// put existing dashboard state into react component state

export class SharePublic extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isPublic: false,
    };
  }

  onIsPublicChange = () => {
    this.setState(({ isPublic }) => ({
      isPublic: !isPublic,
    }));
  };

  onSavePublicConfig = () => {
    savePublicConfig({
      ...this.state,
      dashboardUid: this.props.dashboard.uid,
    } as SharingConfiguration);
  };

  render() {
    const { isPublic } = this.state;
    return (
      <>
        <p className="share-modal-info-text">Sharing for your dashboard</p>
        <Field label="Dashboard is Public" description="Configures whether current dashboard is available publicly">
          <Switch id="share-current-time-range" value={isPublic} onChange={this.onIsPublicChange} />
        </Field>
        <Button onClick={this.onSavePublicConfig}>Save Sharing Configuration</Button>
      </>
    );
  }
}
