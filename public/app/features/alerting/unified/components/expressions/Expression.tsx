import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { FC, useCallback, useState } from 'react';

import { DataFrame, dateTimeFormat, GrafanaTheme2, isTimeSeriesFrames, LoadingState, PanelData } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AutoSizeInput, Button, clearButtonStyles, IconButton, useStyles2 } from '@grafana/ui';
import { ClassicConditions } from 'app/features/expressions/components/ClassicConditions';
import { Math } from 'app/features/expressions/components/Math';
import { Reduce } from 'app/features/expressions/components/Reduce';
import { Resample } from 'app/features/expressions/components/Resample';
import { Threshold } from 'app/features/expressions/components/Threshold';
import {
  ExpressionQuery,
  ExpressionQueryType,
  expressionTypes,
  getExpressionLabel,
} from 'app/features/expressions/types';
import { AlertQuery, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { HoverCard } from '../HoverCard';
import { Spacer } from '../Spacer';
import { AlertStateTag } from '../rules/AlertStateTag';

import { AlertConditionIndicator } from './AlertConditionIndicator';
import { formatLabels, getSeriesLabels, getSeriesName, getSeriesValue, isEmptySeries } from './util';

interface ExpressionProps {
  isAlertCondition?: boolean;
  data?: PanelData;
  error?: Error;
  warning?: Error;
  queries: AlertQuery[];
  query: ExpressionQuery;
  onSetCondition: (refId: string) => void;
  onUpdateRefId: (oldRefId: string, newRefId: string) => void;
  onRemoveExpression: (refId: string) => void;
  onUpdateExpressionType: (refId: string, type: ExpressionQueryType) => void;
  onChangeQuery: (query: ExpressionQuery) => void;
}

export const Expression: FC<ExpressionProps> = ({
  queries = [],
  query,
  data,
  error,
  warning,
  isAlertCondition,
  onSetCondition,
  onUpdateRefId,
  onRemoveExpression,
  onUpdateExpressionType,
  onChangeQuery,
}) => {
  const styles = useStyles2(getStyles);

  const queryType = query?.type;

  const isLoading = data && Object.values(data).some((d) => Boolean(d) && d.state === LoadingState.Loading);
  const hasResults = Array.isArray(data?.series) && !isLoading;
  const series = data?.series ?? [];
  const seriesCount = series.length;

  const alertCondition = isAlertCondition ?? false;
  //const showSummary = isAlertCondition && hasResults;

  const groupedByState = {
    [PromAlertingRuleState.Firing]: series.filter((serie) => getSeriesValue(serie) >= 1),
    [PromAlertingRuleState.Inactive]: series.filter((serie) => getSeriesValue(serie) < 1),
  };

  const renderExpressionType = useCallback(
    (query: ExpressionQuery) => {
      // these are the refs we can choose from that don't include the current one
      const availableRefIds = queries
        .filter((q) => query.refId !== q.refId)
        .map((q) => ({ value: q.refId, label: q.refId }));

      switch (query.type) {
        case ExpressionQueryType.math:
          return <Math onChange={onChangeQuery} query={query} labelWidth={'auto'} onRunQuery={() => {}} />;

        case ExpressionQueryType.reduce:
          return <Reduce onChange={onChangeQuery} refIds={availableRefIds} labelWidth={'auto'} query={query} />;

        case ExpressionQueryType.resample:
          return <Resample onChange={onChangeQuery} query={query} labelWidth={'auto'} refIds={availableRefIds} />;

        case ExpressionQueryType.classic:
          return <ClassicConditions onChange={onChangeQuery} query={query} refIds={availableRefIds} />;

        case ExpressionQueryType.threshold:
          return <Threshold onChange={onChangeQuery} query={query} labelWidth={'auto'} refIds={availableRefIds} />;

        default:
          return <>Expression not supported: {query.type}</>;
      }
    },
    [onChangeQuery, queries]
  );
  const selectedExpressionType = expressionTypes.find((o) => o.value === queryType);
  const selectedExpressionDescription = selectedExpressionType?.description ?? '';

  return (
    <div
      className={cx(
        styles.expression.wrapper,
        alertCondition && styles.expression.alertCondition,
        queryType === ExpressionQueryType.classic && styles.expression.classic,
        queryType !== ExpressionQueryType.classic && styles.expression.nonClassic
      )}
    >
      <div className={styles.expression.stack}>
        <Header
          refId={query.refId}
          queryType={queryType}
          onRemoveExpression={() => onRemoveExpression(query.refId)}
          onUpdateRefId={(newRefId) => onUpdateRefId(query.refId, newRefId)}
          onUpdateExpressionType={(type) => onUpdateExpressionType(query.refId, type)}
          onSetCondition={onSetCondition}
          warning={warning}
          error={error}
          query={query}
          alertCondition={alertCondition}
        />
        <div className={styles.expression.body}>
          <div className={styles.expression.description}>{selectedExpressionDescription}</div>
          {renderExpressionType(query)}
        </div>
        {hasResults && (
          <>
            <ExpressionResult series={series} isAlertCondition={isAlertCondition} />

            <div className={styles.footer}>
              <Stack direction="row" alignItems="center">
                <Spacer />

                <PreviewSummary
                  isCondition={Boolean(isAlertCondition)}
                  firing={groupedByState[PromAlertingRuleState.Firing].length}
                  normal={groupedByState[PromAlertingRuleState.Inactive].length}
                  seriesCount={seriesCount}
                />
              </Stack>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface ExpressionResultProps {
  series: DataFrame[];
  isAlertCondition?: boolean;
}
export const PAGE_SIZE = 20;
export const ExpressionResult: FC<ExpressionResultProps> = ({ series, isAlertCondition }) => {
  const { pageItems, previousPage, nextPage, numberOfPages, pageStart, pageEnd } = usePagination(series, 1, PAGE_SIZE);
  const styles = useStyles2(getStyles);

  // sometimes we receive results where every value is just "null" when noData occurs
  const emptyResults = isEmptySeries(series);
  const isTimeSeriesResults = !emptyResults && isTimeSeriesFrames(series);

  const shouldShowPagination = numberOfPages > 1;

  return (
    <div className={styles.expression.results}>
      {!emptyResults && isTimeSeriesResults && (
        <div>
          {pageItems.map((frame, index) => (
            <TimeseriesRow
              key={uniqueId()}
              frame={frame}
              index={pageStart + index}
              isAlertCondition={isAlertCondition}
            />
          ))}
        </div>
      )}
      {!emptyResults &&
        !isTimeSeriesResults &&
        pageItems.map((frame, index) => (
          // There's no way to uniquely identify a frame that doesn't cause render bugs :/ (Gilles)
          <FrameRow key={uniqueId()} frame={frame} index={pageStart + index} isAlertCondition={isAlertCondition} />
        ))}
      {emptyResults && <div className={cx(styles.expression.noData, styles.mutedText)}>No data</div>}
      {shouldShowPagination && (
        <div className={styles.pagination.wrapper} data-testid="paginate-expression">
          <Stack>
            <Button
              variant="secondary"
              fill="outline"
              onClick={previousPage}
              icon="angle-left"
              size="sm"
              aria-label="previous-page"
            />
            <Spacer />
            <span className={styles.mutedText}>
              {pageStart} - {pageEnd} of {series.length}
            </span>
            <Spacer />
            <Button
              variant="secondary"
              fill="outline"
              onClick={nextPage}
              icon="angle-right"
              size="sm"
              aria-label="next-page"
            />
          </Stack>
        </div>
      )}
    </div>
  );
};

export const PreviewSummary: FC<{ firing: number; normal: number; isCondition: boolean; seriesCount: number }> = ({
  firing,
  normal,
  isCondition,
  seriesCount,
}) => {
  const { mutedText } = useStyles2(getStyles);
  if (isCondition) {
    return <span className={mutedText}>{`${seriesCount} series: ${firing} firing, ${normal} normal`}</span>;
  }
  return <span className={mutedText}>{`${seriesCount} series`}</span>;
};

interface HeaderProps {
  refId: string;
  queryType: ExpressionQueryType;
  onUpdateRefId: (refId: string) => void;
  onRemoveExpression: () => void;
  onUpdateExpressionType: (type: ExpressionQueryType) => void;
  warning?: Error;
  error?: Error;
  onSetCondition: (refId: string) => void;
  query: ExpressionQuery;
  alertCondition: boolean;
}

const Header: FC<HeaderProps> = ({
  refId,
  queryType,
  onUpdateRefId,
  onRemoveExpression,
  warning,
  onSetCondition,
  alertCondition,
  query,
  error,
}) => {
  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);
  /**
   * There are 3 edit modes:
   *
   * 1. "refId": Editing the refId (ie. A -> B)
   * 2. "expressionType": Editing the type of the expression (ie. Reduce -> Math)
   * 3. "false": This means we're not editing either of those
   */
  const [editMode, setEditMode] = useState<'refId' | 'expressionType' | false>(false);

  const editing = editMode !== false;
  const editingRefId = editing && editMode === 'refId';

  return (
    <header className={styles.header.wrapper}>
      <Stack direction="row" gap={0.5} alignItems="center">
        <Stack direction="row" gap={1} alignItems="center" wrap={false}>
          {!editingRefId && (
            <button type="button" className={cx(clearButton, styles.editable)} onClick={() => setEditMode('refId')}>
              <div className={styles.expression.refId}>{refId}</div>
            </button>
          )}
          {editingRefId && (
            <AutoSizeInput
              autoFocus
              defaultValue={refId}
              minWidth={5}
              onChange={(event) => {
                onUpdateRefId(event.currentTarget.value);
                setEditMode(false);
              }}
              onFocus={(event) => event.target.select()}
              onBlur={(event) => {
                onUpdateRefId(event.currentTarget.value);
                setEditMode(false);
              }}
            />
          )}
          <div>{getExpressionLabel(queryType)}</div>
        </Stack>
        <Spacer />
        <AlertConditionIndicator
          onSetCondition={() => onSetCondition(query.refId)}
          enabled={alertCondition}
          error={error}
          warning={warning}
        />
        <IconButton
          name="trash-alt"
          variant="secondary"
          className={styles.mutedIcon}
          onClick={onRemoveExpression}
          tooltip="Remove expression"
        />
      </Stack>
    </header>
  );
};

interface FrameProps extends Pick<ExpressionProps, 'isAlertCondition'> {
  frame: DataFrame;
  index: number;
}

const FrameRow: FC<FrameProps> = ({ frame, index, isAlertCondition }) => {
  const styles = useStyles2(getStyles);

  const name = getSeriesName(frame) || 'Series ' + index;
  const value = getSeriesValue(frame);
  const labelsRecord = getSeriesLabels(frame);
  const labels = Object.entries(labelsRecord);
  const hasLabels = labels.length > 0;

  const showFiring = isAlertCondition && value !== 0;
  const showNormal = isAlertCondition && value === 0;

  const title = `${hasLabels ? '' : name}${hasLabels ? `{${formatLabels(labelsRecord)}}` : ''}`;

  return (
    <div className={styles.expression.resultsRow}>
      <Stack direction="row" gap={1} alignItems="center">
        <div className={styles.expression.resultLabel} title={title}>
          <span>{hasLabels ? '' : name}</span>
          {hasLabels && (
            <>
              <span>{'{'}</span>
              {labels.map(([key, value], index) => (
                <span key={uniqueId()}>
                  <span className={styles.expression.labelKey}>{key}</span>
                  <span>=</span>
                  <span>&quot;</span>
                  <span className={styles.expression.labelValue}>{value}</span>
                  <span>&quot;</span>
                  {index < labels.length - 1 && <span>, </span>}
                </span>
              ))}
              <span>{'}'}</span>
            </>
          )}
        </div>
        <div className={styles.expression.resultValue}>{value}</div>
        {showFiring && <AlertStateTag state={PromAlertingRuleState.Firing} size="sm" />}
        {showNormal && <AlertStateTag state={PromAlertingRuleState.Inactive} size="sm" />}
      </Stack>
    </div>
  );
};

const TimeseriesRow: FC<FrameProps & { index: number }> = ({ frame, index }) => {
  const styles = useStyles2(getStyles);

  const valueField = frame.fields[1]; // field 0 is "time", field 1 is "value"

  const hasLabels = valueField.labels;
  const displayNameFromDS = valueField.config?.displayNameFromDS;
  const name = displayNameFromDS ?? (hasLabels ? formatLabels(valueField.labels ?? {}) : 'Series ' + index);

  const timestamps = frame.fields[0].values;

  const getTimestampFromIndex = (index: number) => frame.fields[0].values[index];
  const getValueFromIndex = (index: number) => frame.fields[1].values[index];

  return (
    <div className={styles.expression.resultsRow}>
      <Stack direction="row" alignItems="center">
        <span className={cx(styles.mutedText, styles.expression.resultLabel)} title={name}>
          {name}
        </span>
        <div className={styles.expression.resultValue}>
          <HoverCard
            placement="right"
            wrapperClassName={styles.timeseriesTableWrapper}
            content={
              <table className={styles.timeseriesTable}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {timestamps.map((_, index) => (
                    <tr key={index}>
                      <td className={styles.mutedText}>{dateTimeFormat(getTimestampFromIndex(index))}</td>
                      <td className={styles.expression.resultValue}>{getValueFromIndex(index)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <span>Time series data</span>
          </HoverCard>
        </div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  expression: {
    wrapper: css`
      display: flex;
      border: solid 1px ${theme.colors.border.medium};
      flex: 1;
      flex-basis: 400px;
      border-radius: ${theme.shape.borderRadius()};
    `,
    stack: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 0;
      width: 100%;
      min-width: 0; // this one is important to prevent text overflow
    `,
    classic: css`
      max-width: 100%;
    `,
    nonClassic: css`
      max-width: 640px;
    `,
    alertCondition: css``,
    body: css`
      padding: ${theme.spacing(1)};
      flex: 1;
    `,
    description: css`
      margin-bottom: ${theme.spacing(1)};
      font-size: ${theme.typography.size.xs};
      color: ${theme.colors.text.secondary};
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.primary.text};
    `,
    results: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;

      border-top: solid 1px ${theme.colors.border.medium};
    `,
    noResults: css`
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    resultsRow: css`
      padding: ${theme.spacing(0.75)} ${theme.spacing(1)};

      &:nth-child(odd) {
        background-color: ${theme.colors.background.secondary};
      }

      &:hover {
        background-color: ${theme.colors.background.canvas};
      }
    `,
    labelKey: css`
      color: ${theme.isDark ? '#73bf69' : '#56a64b'};
    `,
    labelValue: css`
      color: ${theme.isDark ? '#ce9178' : '#a31515'};
    `,
    resultValue: css`
      text-align: right;
    `,
    resultLabel: css`
      flex: 1;
      overflow-x: auto;

      display: inline-block;
      white-space: nowrap;
    `,
    noData: css`
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${theme.spacing()};
    `,
  },
  mutedText: css`
    color: ${theme.colors.text.secondary};
    font-size: 0.9em;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  header: {
    wrapper: css`
      background: ${theme.colors.background.secondary};
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      border-bottom: solid 1px ${theme.colors.border.weak};
    `,
  },
  footer: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    border-top: solid 1px ${theme.colors.border.weak};
  `,
  draggableIcon: css`
    cursor: grab;
  `,
  mutedIcon: css`
    color: ${theme.colors.text.secondary};
  `,
  editable: css`
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius()};

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};

    cursor: pointer;
  `,
  timeseriesTableWrapper: css`
    max-height: 500px;

    overflow-y: scroll;
  `,
  timeseriesTable: css`
    table-layout: auto;

    width: 100%;
    height: 100%;

    td,
    th {
      padding: ${theme.spacing(1)};
    }

    td {
      background: ${theme.colors.background.primary};
    }

    th {
      background: ${theme.colors.background.secondary};
    }

    tr {
      border-bottom: 1px solid ${theme.colors.border.medium};

      &:last-of-type {
        border-bottom: none;
      }
    }
  `,
  pagination: {
    wrapper: css`
      border-top: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing()};
    `,
  },
});
