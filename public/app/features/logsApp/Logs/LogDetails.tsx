import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { v4 } from 'uuid';

import { CoreApp, DataFrame, DataFrameType, Field, LinkModel, LogRowModel } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';
import { createLogLineLinks, getAllFields } from 'app/features/logs/components/logParser';
import { calculateLogsLabelStats, calculateStats } from 'app/features/logs/utils';

import { LogDetailsRow } from './LogDetailsRow';

export interface Props {
  row: LogRowModel;
  showDuplicates: boolean;
  rows: LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;
  app?: CoreApp;
  styles: LogRowStyles;

  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
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
  const baseKey = useMemo(() => v4(), [rows, labels]);
  // Without baseKey, when a new query is run and LogDetailsRow doesn't fully re-render, it freezes the app

  // For now, we support first tempo data source
  const TempoDs = useMemo(
    () =>
      getDataSourceSrv()
        .getList({ tracing: true })
        .find((d) => d.type === 'tempo'),
    []
  );

  return (
    <div className={cx(className, styles.logDetails)}>
      <div className={styles.logDetailsContainer}>
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
                  key={`${key}=${value}-${i}-${baseKey}`}
                  parsedKeys={[key]}
                  parsedValues={[value]}
                  isLabel={true}
                  getStats={() => calculateLogsLabelStats(rows, key)}
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
              const { keys, values, fieldIndex } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onClickFilterLabel={onClickFilterLabel}
                  getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
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
              const { keys, values, links, fieldIndex } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  links={links}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
                  displayedFields={displayedFields}
                  wrapLogMessage={wrapLogMessage}
                  row={row}
                  app={app}
                  disableActions={false}
                />
              );
            })}
            {fieldsWithLinksFromVariableMap?.map((field, i) => {
              const { keys, values, links, fieldIndex } = field;
              return (
                <LogDetailsRow
                  key={`${keys[0]}=${values[0]}-${i}`}
                  parsedKeys={keys}
                  parsedValues={values}
                  links={links}
                  onClickShowField={onClickShowField}
                  onClickHideField={onClickHideField}
                  getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
                  displayedFields={displayedFields}
                  wrapLogMessage={wrapLogMessage}
                  row={row}
                  app={app}
                  disableActions={true}
                />
              );
            })}

            {row.possibleTraceId && TempoDs && (
              <tr style={{ margin: '4px 0' }}>
                <th colSpan={6}>
                  <LinkButton
                    size="sm"
                    variant="primary"
                    icon="compass"
                    target="_blank"
                    href={createUrl(`/explore`, {
                      left: JSON.stringify({
                        datasource: TempoDs.uid,
                        queries: [{ refId: 'A', query: row.possibleTraceId }],
                      }),
                    })}
                  >
                    {`Open detected trace ${row.possibleTraceId}`}
                  </LinkButton>
                </th>
              </tr>
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
