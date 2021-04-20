import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';

import { DebugPanelOptions, DebugMode, UpdateCounters } from './types';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';

type Props = PanelProps<DebugPanelOptions>;

export class DebugPanel extends Component<Props> {
  // Intentionally not state to avoid overhead -- yes, things will be 1 tick behind
  lastRender = Date.now();
  counters: UpdateCounters = {
    render: 0,
    dataChanged: 0,
    schemaChanged: 0,
  };

  shouldComponentUpdate(prevProps: Props) {
    const { data, options } = this.props;

    if (prevProps.data !== data) {
      this.counters.dataChanged++;

      if (options.counters?.schemaChanged) {
        if (data.structureRev !== prevProps.data.structureRev) {
          this.counters.schemaChanged++;
        }
      }
    }
    return true; // always render?
  }

  resetCounters = () => {
    this.counters = {
      render: 0,
      dataChanged: 0,
      schemaChanged: 0,
    };
    this.setState(this.state); // force update
  };

  render() {
    const { options } = this.props;
    if (options.mode === DebugMode.Events) {
      return <EventBusLoggerPanel eventBus={this.props.eventBus} />;
    }

    return <RenderInfoViewer {...this.props} />;
  }
}
