import { Component } from 'react';

import {
  compareArrayValues,
  compareDataFrameStructures,
  fieldReducers,
  getFieldDisplayName,
  getFrameDisplayName,
  PanelProps,
  ReducerID,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

import { Options, UpdateConfig } from './panelcfg.gen';

type Props = PanelProps<Options>;

type UpdateCounters = {
  [K in keyof UpdateConfig]: number;
};

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
    const showCounters = options.counters ?? {
      render: false,
      dataChanged: false,
      schemaChanged: false,
    };
    this.counters.render++;
    const now = Date.now();
    const elapsed = now - this.lastRender;
    this.lastRender = now;

    const reducer = fieldReducers.get(ReducerID.lastNotNull);

    return (
      <div>
        <div>
          <IconButton
            name="step-backward"
            title={t('debug.render-info-viewer.title-reset-counters', 'Reset counters')}
            onClick={this.resetCounters}
            tooltip={t('debug.render-info-viewer.tooltip-step-back', 'Step back')}
          />
          <span>
            {showCounters.render && (
              <span>
                <Trans i18nKey="debug.render-info-viewer.render-counter" values={{ numRenders: this.counters.render }}>
                  Render: {'{{numRenders}}'}&nbsp;
                </Trans>
              </span>
            )}
            {showCounters.dataChanged && (
              <span>
                <Trans
                  i18nKey="debug.render-info-viewer.data-counter"
                  values={{ numDataChanges: this.counters.dataChanged }}
                >
                  Data: {'{{numDataChanges}}'}&nbsp;
                </Trans>
              </span>
            )}
            {showCounters.schemaChanged && (
              <span>
                <Trans
                  i18nKey="debug.render-info-viewer.schema-counter"
                  values={{ numSchemaChanges: this.counters.schemaChanged }}
                >
                  Schema: {'{{numSchemaChanges}}'}&nbsp;
                </Trans>
              </span>
            )}
            <span>
              <Trans i18nKey="debug.render-info-viewer.elapsed-time">Time: {{ elapsed }}ms</Trans>
            </span>
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
                    <td>
                      <Trans i18nKey="debug.render-info-viewer.field">Field</Trans>
                    </td>
                    <td>
                      <Trans i18nKey="debug.render-info-viewer.type">Type</Trans>
                    </td>
                    <td>
                      <Trans i18nKey="debug.render-info-viewer.last">Last</Trans>
                    </td>
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
