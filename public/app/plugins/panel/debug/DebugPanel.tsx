import React, { Component } from 'react';

import { PanelProps } from '@grafana/data';

import { CursorView } from './CursorView';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';
import { StateView } from './StateView';
import { Options, DebugMode } from './panelcfg.gen';

type Props = PanelProps<Options>;

export class DebugPanel extends Component<Props> {
  render() {
    const { options } = this.props;

    switch (options.mode) {
      case DebugMode.Events:
        return <EventBusLoggerPanel eventBus={this.props.eventBus} />;
      case DebugMode.Cursor:
        return <CursorView eventBus={this.props.eventBus} />;
      case DebugMode.State:
        return <StateView {...this.props} />;
      case DebugMode.ThrowError:
        throw new Error('I failed you and for that i am deeply sorry');
      default:
        return <RenderInfoViewer {...this.props} />;
    }
  }
}
