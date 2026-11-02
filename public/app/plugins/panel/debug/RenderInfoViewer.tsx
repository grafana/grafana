import { useReducer, useRef } from 'react';

import {
  compareArrayValues,
  compareDataFrameStructures,
  fieldReducers,
  getFieldDisplayName,
  getFrameDisplayName,
  type PanelProps,
  ReducerID,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

import { type Options, type UpdateConfig } from './panelcfg.gen';

type Props = PanelProps<Options>;

type UpdateCounters = {
  [K in keyof UpdateConfig]: number;
};

const initialCounters: UpdateCounters = {
  render: 0,
  dataChanged: 0,
  schemaChanged: 0,
};

export const RenderInfoViewer = ({ data, options }: Props) => {
  // Intentionally not state to avoid overhead -- yes, things will be 1 tick behind
  const lastRender = useRef(Date.now());
  const countersRef = useRef({ ...initialCounters });
  const prevData = useRef(data);
  // Counters live in a ref, so resetting them needs an explicit re-render
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const counters = countersRef.current;
  if (prevData.current !== data) {
    counters.dataChanged++;

    if (options.counters?.schemaChanged) {
      const oldSeries = prevData.current?.series;
      const series = data.series;
      if (series && oldSeries) {
        const sameStructure = compareArrayValues(series, oldSeries, compareDataFrameStructures);
        if (!sameStructure) {
          counters.schemaChanged++;
        }
      }
    }
    prevData.current = data;
  }

  const resetCounters = () => {
    countersRef.current = { ...initialCounters };
    forceRender();
  };

  const showCounters = options.counters ?? {
    render: false,
    dataChanged: false,
    schemaChanged: false,
  };
  counters.render++;
  const now = Date.now();
  const elapsed = now - lastRender.current;
  lastRender.current = now;

  const reducer = fieldReducers.get(ReducerID.lastNotNull);

  return (
    <div>
      <div>
        <IconButton
          name="step-backward"
          title={t('debug.render-info-viewer.title-reset-counters', 'Reset counters')}
          onClick={resetCounters}
          tooltip={t('debug.render-info-viewer.tooltip-step-back', 'Step back')}
        />
        <span>
          {showCounters.render && (
            <span>
              <Trans i18nKey="debug.render-info-viewer.render-counter" values={{ numRenders: counters.render }}>
                Render: {'{{numRenders}}'}&nbsp;
              </Trans>
            </span>
          )}
          {showCounters.dataChanged && (
            <span>
              <Trans i18nKey="debug.render-info-viewer.data-counter" values={{ numDataChanges: counters.dataChanged }}>
                Data: {'{{numDataChanges}}'}&nbsp;
              </Trans>
            </span>
          )}
          {showCounters.schemaChanged && (
            <span>
              <Trans
                i18nKey="debug.render-info-viewer.schema-counter"
                values={{ numSchemaChanges: counters.schemaChanged }}
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
};
