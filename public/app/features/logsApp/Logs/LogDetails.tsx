import { cx } from '@emotion/css';
import React, { useMemo, useState, useEffect } from 'react';
import { useAsync } from 'react-use';
import { firstValueFrom } from 'rxjs';
import { v4 } from 'uuid';

import {
  CoreApp,
  DataFrame,
  DataFrameType,
  Field,
  LinkModel,
  LogRowModel,
  LogsDedupStrategy,
  getDefaultTimeRange,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, Collapse, LinkButton } from '@grafana/ui';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';
import { LogRows } from 'app/features/logs/components/LogRows';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';
import { createLogLineLinks, getAllFields } from 'app/features/logs/components/logParser';
import { TempoDatasource } from 'app/plugins/datasource/tempo/datasource';

import { ExplainLogLine } from '../ExplainLogLine';

import { LogDetailsRow } from './LogDetailsRow';
import { LogRowMenu } from './LogRowMenu';

export interface Props {
  row: LogRowModel;
  showDuplicates: boolean;
  rows: LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;
  app?: CoreApp;
  styles: LogRowStyles;
  prettifyLogMessage: boolean;
  onClickFilterValue?: (value: string, refId?: string) => void;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick: (row: LogRowModel) => Promise<void>;
  showContextToggle?: (row: LogRowModel) => boolean;
  onSimilarityChange: (row: LogRowModel, type: 'show' | 'hide') => void;
}

export const LogDetails = (props: Props) => {
  const {
    app,
    row,
    onClickFilterOutLabel,
    onClickFilterLabel,
    rows,
    className,
    onClickShowField,
    onClickHideField,
    displayedFields,
    getFieldLinks,
    wrapLogMessage,
    styles,
    onSimilarityChange,
    onClickFilterValue,
  } = props;
  const labels = useMemo(() => (row.labels ? row.labels : {}), [row.labels]);
  const labelsAvailable = useMemo(() => Object.keys(labels).length > 0, [labels]);
  const fieldsAndLinks = useMemo(() => getAllFields(row, getFieldLinks), [getFieldLinks, row]);
  let fieldsWithLinks = useMemo(() => fieldsAndLinks.filter((f) => f.links?.length), [fieldsAndLinks]);
  const displayedFieldsWithLinks = useMemo(
    () => fieldsWithLinks.filter((f) => f.fieldIndex !== row.entryFieldIndex).sort(),
    [fieldsWithLinks, row.entryFieldIndex]
  );
  const hiddenFieldsWithLinks = useMemo(
    () => fieldsWithLinks.filter((f) => f.fieldIndex === row.entryFieldIndex).sort(),
    [fieldsWithLinks, row.entryFieldIndex]
  );
  const fieldsWithLinksFromVariableMap = useMemo(
    () => createLogLineLinks(hiddenFieldsWithLinks),
    [hiddenFieldsWithLinks]
  );
  const fieldsWithLinksAvailable = useMemo(
    () =>
      (displayedFieldsWithLinks && displayedFieldsWithLinks.length > 0) ||
      (fieldsWithLinksFromVariableMap && fieldsWithLinksFromVariableMap.length > 0),
    [displayedFieldsWithLinks, fieldsWithLinksFromVariableMap]
  );

  const [traceViewOpen, setTraceViewOpen] = useState(true);
  const [traceLogsViewOpen, setTraceLogsViewOpen] = useState(true);

  const fields = useMemo(
    () =>
      row.dataFrame.meta?.type === DataFrameType.LogLines
        ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
          []
        : // for other frames, do not show the log message unless there is a link attached
          fieldsAndLinks.filter((f) => f.links?.length === 0 && f.fieldIndex !== row.entryFieldIndex).sort(),
    [fieldsAndLinks, row.dataFrame.meta?.type, row.entryFieldIndex]
  );
  const fieldsAvailable = useMemo(() => fields && fields.length > 0, [fields]);

  const labelKeys = useMemo(() => Object.keys(labels).sort(), [labels]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const baseKey = useMemo(() => v4(), [rows, row, labels]);
  // Without baseKey, when a new query is run and LogDetailsRow doesn't fully re-render, it freezes the app

  // For now, we support first tempo data source
  const tempoDsSettings = useMemo(
    () =>
      getDataSourceSrv()
        .getList({ tracing: true })
        .find((d) => d.type === 'tempo'),
    []
  );

  const tempoDs = useAsync(async () => {
    if (!tempoDsSettings) {
      return undefined;
    }

    return await getDataSourceSrv().get(tempoDsSettings.name);
  }, [tempoDsSettings]);

  const traceDf = useAsync(async () => {
    if (!tempoDs.value || !row.possibleTraceId) {
      return undefined;
    }

    const traceObservable = firstValueFrom(
      (tempoDs.value as TempoDatasource).query({
        targets: [
          {
            refId: 'A',
            queryType: 'traceql',
            query: row.possibleTraceId,
            filters: [],
          },
        ],
        requestId: v4(),
        app: 'logsApp',
        range: getDefaultTimeRange(),
        interval: '1s',
        intervalMs: 1000,
        timezone: 'utc',
        scopedVars: {},
        startTime: row.timeEpochMs,
      })
    );
    const traceData = await traceObservable;
    return traceData.data as DataFrame[];
  }, [tempoDs, row.possibleTraceId, row.timeEpochMs]);

  const transformedTraceData = useMemo(() => {
    if (!traceDf.value || !traceDf.value[0]) {
      return null;
    }

    return transformDataFrames(traceDf.value[0]);
  }, [traceDf.value]);

  const [correlatedLogs, setCorrelatedLogs] = useState<LogRowModel[]>([]);

  useEffect(() => {
    let logs: LogRowModel[] = [];
    if (row.possibleTraceId) {
      logs = rows.filter((r) => r.possibleTraceId === row.possibleTraceId);
    } else if (row.possibleCorrelationId) {
      logs = rows.filter((r) => r.possibleCorrelationId === row.possibleCorrelationId);
    }
    setCorrelatedLogs(logs);
  }, [rows, row.possibleTraceId, row.possibleCorrelationId]);

  return (
    <div className={cx(className, styles.logDetails)}>
      <div className={styles.logDetailsContainer}>
        <LogRowMenu
          row={row}
          showContextToggle={props.showContextToggle}
          prettifyLogMessage={props.prettifyLogMessage}
          onOpenContext={props.onOpenContext}
          onPermalinkClick={props.onPermalinkClick}
          styles={styles}
          onSimilarityChange={onSimilarityChange}
        />
        <ExplainLogLine logLine={row.entry} />

        <table className={styles.logDetailsTable}>
          <tbody>
            {(labelsAvailable || fieldsAvailable) && (
              <tr>
                <td colSpan={100} className={styles.logDetailsHeading} aria-label="Fields">
                  Fields
                </td>
              </tr>
            )}
            {labelKeys.map((key, i) => {
              const value = labels[key];
              return (
                <LogDetailsRow
                  key={`${key}=${value}-${i}-${baseKey}-${v4()}`}
                  parsedKeys={[key]}
                  parsedValues={[value]}
                  isLabel={true}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  row={row}
                  app={app}
                  wrapLogMessage={wrapLogMessage}
                  displayedFields={displayedFields}
                  disableActions={false}
                  isFilterLabelActive={props.isFilterLabelActive}
                />
              );
            })}
            {fields.map((field, i) => {
              const { keys, values } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}-${baseKey}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onClickFilterLabel={onClickFilterLabel}
                  displayedFields={displayedFields}
                  wrapLogMessage={wrapLogMessage}
                  row={row}
                  app={app}
                  disableActions={false}
                  isFilterLabelActive={props.isFilterLabelActive}
                />
              );
            })}

            {fieldsWithLinksAvailable && (
              <tr>
                <td colSpan={100} className={styles.logDetailsHeading} aria-label="Data Links">
                  Links
                </td>
              </tr>
            )}
            {displayedFieldsWithLinks.map((field, i) => {
              const { keys, values, links } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}-${baseKey}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  links={links}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  displayedFields={displayedFields}
                  wrapLogMessage={wrapLogMessage}
                  row={row}
                  app={app}
                  disableActions={false}
                />
              );
            })}
            {fieldsWithLinksFromVariableMap?.map((field, i) => {
              const { keys, values, links } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}-${baseKey}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  links={links}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  displayedFields={displayedFields}
                  wrapLogMessage={wrapLogMessage}
                  row={row}
                  app={app}
                  disableActions={true}
                />
              );
            })}

            {row.possibleTraceId && tempoDs.value && traceDf.value && transformedTraceData && (
              <>
                <tr><th colSpan={6} style={{ height: '1em' }}></th></tr>
                <tr>
                  <th colSpan={6}>
                    <Collapse
                      label="Trace View"
                      collapsible={true}
                      isOpen={traceViewOpen}
                      onToggle={(isOpen) => setTraceViewOpen(isOpen)}
                    >
                      <>
                        <LinkButton
                          size="sm"
                          className={styles.collapsibleButton}
                          variant="secondary"
                          icon="external-link-alt"
                          target="_blank"
                          href={createUrl(`/explore`, {
                            left: JSON.stringify({
                              datasource: tempoDs.value.uid,
                              queries: [{ refId: 'A', query: row.possibleTraceId }],
                              range: getDefaultTimeRange(),
                            }),
                          })}
                        >
                          Open in Explore
                        </LinkButton>
                        <TraceView
                          dataFrames={traceDf.value}
                          traceProp={transformedTraceData}
                          datasource={tempoDs.value}
                        />
                      </>
                    </Collapse>
                  </th>
                </tr>
              </>
            )}
            {correlatedLogs.length > 0 && (
              <>
                <tr><th colSpan={6} style={{ height: '1em' }}></th></tr>
                <tr style={{ padding: '1em 0' }}>
                  <th colSpan={6}>
                    <Collapse
                      label={`${row.possibleTraceId ? 'Trace' : 'Correlated'} Logs`}
                      collapsible={true}
                      isOpen={traceLogsViewOpen}
                      onToggle={(isOpen) => setTraceLogsViewOpen(isOpen)}
                    >
                      <>
                        {onClickFilterValue && (
                          <Button
                            size="sm"
                            className={styles.collapsibleButton}
                            variant="secondary"
                            onClick={() => {
                              // TODO: this is hacky for now as it would just work if the ID is part of the logline, not if it is only a label
                              onClickFilterValue(
                                row.possibleTraceId ?? row.possibleCorrelationId ?? '',
                                row.dataFrame.refId
                              );
                            }}
                          >
                            Show in Logs app
                          </Button>
                        )}
                        <LogRows
                          logRows={correlatedLogs}
                          dedupStrategy={LogsDedupStrategy.none}
                          showLabels={false}
                          showTime={false}
                          wrapLogMessage={true}
                          prettifyLogMessage={false}
                          enableLogDetails={false}
                          timeZone={'utc'}
                          displayedFields={displayedFields}
                          highlightSearchwords={false}
                        />
                      </>
                    </Collapse>
                  </th>
                </tr>
              </>
            )}

            {!fieldsAvailable && !labelsAvailable && !fieldsWithLinksAvailable && (
              <tr>
                <td colSpan={100} aria-label="No details">
                  No details available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
