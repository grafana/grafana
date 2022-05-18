import React, { Component } from 'react';

import {
  compareArrayValues,
  compareDataFrameStructures,
  fieldReducers,
  getFieldDisplayName,
  getFrameDisplayName,
  PanelProps,
  ReducerID,
} from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { DebugPanelOptions, UpdateCounters, UpdateConfig } from './types';

type Props = PanelProps<DebugPanelOptions>;

export class RenderInfoViewer extends Component<Props> {
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
        const oldSeries = prevProps.data?.series;
        const series = data.series;
        if (series && oldSeries) {
          const sameStructure = compareArrayValues(series, oldSeries, compareDataFrameStructures);
          if (!sameStructure) {
            this.counters.schemaChanged++;
          }
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
    this.forceUpdate();
  };

  render() {
    const { data, options } = this.props;
    const showCounters = options.counters ?? ({} as UpdateConfig);
    this.counters.render++;
    const now = Date.now();
    const elapsed = now - this.lastRender;
    this.lastRender = now;

    const reducer = fieldReducers.get(ReducerID.lastNotNull);

    return (
      <div>
        <div>
          <IconButton name="step-backward" title="reset counters" onClick={this.resetCounters} />
          <span>
            {showCounters.render && <span>Render: {this.counters.render}&nbsp;</span>}
            {showCounters.dataChanged && <span>Data: {this.counters.dataChanged}&nbsp;</span>}
            {showCounters.schemaChanged && <span>Schema: {this.counters.schemaChanged}&nbsp;</span>}
            <span>TIME: {elapsed}ms</span>
          </span>
        </div>

        {data.series &&
          data.series.map((frame, idx) => (
            <div key={`${idx}/${frame.refId}`}>
              <h4>
                {getFrameDisplayName(frame, idx)} ({frame.length})
              </h4>
              <table className="filter-table">
                <thead>
                  <tr>
                    <td>Field</td>
                    <td>Type</td>
                    <td>Last</td>
                  </tr>
                </thead>
                <tbody>
                  {frame.fields.map((field, idx) => {
                    const v = reducer.reduce!(field, false, false)[reducer.id];
                    return (
                      <tr key={`${idx}/${field.name}`}>
                        <td>{getFieldDisplayName(field, frame, data.series)}</td>
                        <td>{field.type}</td>
                        <td>{`${v}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    );
  }
}
