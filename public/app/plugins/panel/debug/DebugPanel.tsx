import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { DebugPanelOptions, DebugMode } from './types';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';
import { CursorView } from './CursorView';

type Props = PanelProps<DebugPanelOptions>;

export class DebugPanel extends Component<Props> {
  render() {
    const { options } = this.props;
    if (options.mode === DebugMode.Events) {
      return <EventBusLoggerPanel eventBus={this.props.eventBus} />;
    }
    if (options.mode === DebugMode.Cursor) {
      return <CursorView eventBus={this.props.eventBus} />;
    }

    return <RenderInfoViewer {...this.props} />;
  }
}
