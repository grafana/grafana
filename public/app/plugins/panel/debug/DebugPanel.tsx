import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { DebugPanelOptions, DebugMode } from './types';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';

type Props = PanelProps<DebugPanelOptions>;

export class DebugPanel extends Component<Props> {
  render() {
    const { options } = this.props;
    if (options.mode === DebugMode.Events) {
      return <EventBusLoggerPanel eventBus={this.props.eventBus} />;
    }

    return <RenderInfoViewer {...this.props} />;
  }
}
