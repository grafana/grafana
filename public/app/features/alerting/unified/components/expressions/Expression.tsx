import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { FC, useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import {
  CoreApp,
  DataFrame,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  dateTimeFormat,
  isTimeSeriesFrames,
} from '@grafana/data';
import { Alert, AutoSizeInput, Button, IconButton, Stack, Text, clearButtonStyles, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { ClassicConditions } from 'app/features/expressions/components/ClassicConditions';
import { Math } from 'app/features/expressions/components/Math';
import { Reduce } from 'app/features/expressions/components/Reduce';
import { Resample } from 'app/features/expressions/components/Resample';
import { SqlExpr } from 'app/features/expressions/components/SqlExpr';
import { Threshold } from 'app/features/expressions/components/Threshold';
import {
  ExpressionQuery,
  ExpressionQueryType,
  expressionTypes,
  getExpressionLabel,
} from 'app/features/expressions/types';
import { AlertQuery, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { usePagination } from '../../hooks/usePagination';
import { RuleFormValues } from '../../types/rule-form';
import { isGrafanaRecordingRuleByType } from '../../utils/rules';
import { PopupCard } from '../HoverCard';
import { Spacer } from '../Spacer';
import { AlertStateTag } from '../rules/AlertStateTag';

import { ExpressionStatusIndicator } from './ExpressionStatusIndicator';
import { formatLabels, formatSeriesValue, getSeriesLabels, getSeriesName, getSeriesValue, isEmptySeries } from './util';

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
  onUpdateExpressionType, // this method is not used? maybe we should remove it
  onChangeQuery,
}) => {
  const styles = useStyles2(getStyles);

  const queryType = query?.type;

  const { setError, clearErrors, watch } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const isGrafanaRecordingRule = type ? isGrafanaRecordingRuleByType(type) : false;

  const onQueriesValidationError = useCallback(
    (errorMsg: string | undefined) => {
      if (errorMsg) {
        setError('queries', { type: 'custom', message: errorMsg });
      } else {
        clearErrors('queries');
      }
    },
    [setError, clearErrors]
  );

  const isLoading = data && Object.values(data).some((d) => Boolean(d) && d.state === LoadingState.Loading);
  const hasResults = Array.isArray(data?.series) && !isLoading;
  const series = data?.series ?? [];

  const alertCondition = isAlertCondition ?? false;

  const { seriesCount, groupedByState } = getGroupedByStateAndSeriesCount(series);

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
          return (
            <Reduce
              onChange={onChangeQuery}
              refIds={availableRefIds}
              labelWidth={'auto'}
              app={CoreApp.UnifiedAlerting}
              query={query}
            />
          );

        case ExpressionQueryType.resample:
          return <Resample onChange={onChangeQuery} query={query} labelWidth={'auto'} refIds={availableRefIds} />;

        case ExpressionQueryType.classic:
          return <ClassicConditions onChange={onChangeQuery} query={query} refIds={availableRefIds} />;

        case ExpressionQueryType.threshold:
          return (
            <Threshold
              onChange={onChangeQuery}
              query={query}
              labelWidth={'auto'}
              refIds={availableRefIds}
              onError={onQueriesValidationError}
              useHysteresis={true}
            />
          );

        case ExpressionQueryType.sql:
          return <SqlExpr onChange={(query) => onChangeQuery(query)} query={query} refIds={availableRefIds} alerting />;

        default:
          return (
            <Trans i18nKey="alerting.expression.not-supported" values={{ expression: query.type }}>
              Expression not supported: {'{{expression}}'}
            </Trans>
          );
      }
    },
    [onChangeQuery, queries, onQueriesValidationError]
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
          onSetCondition={onSetCondition}
          query={query}
          alertCondition={alertCondition}
        />
        <div className={styles.expression.body}>
          {error && (
            <Alert title={t('alerting.expression.title-expression-failed', 'Expression failed')} severity="error">
              {error.message}
            </Alert>
          )}
          {warning && (
            <Alert title={t('alerting.expression.title-expression-warning', 'Expression warning')} severity="warning">
              {warning.message}
            </Alert>
          )}
          <div className={styles.expression.description}>{selectedExpressionDescription}</div>
          {renderExpressionType(query)}
        </div>
        {hasResults && (
          <>
            <ExpressionResult
              series={series}
              isAlertCondition={isAlertCondition}
              isRecordingRule={isGrafanaRecordingRule}
            />
            {!isGrafanaRecordingRule && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface ExpressionResultProps {
  series: DataFrame[];
  isAlertCondition?: boolean;
  isRecordingRule?: boolean;
}
export const PAGE_SIZE = 20;
export const ExpressionResult: FC<ExpressionResultProps> = ({ series, isAlertCondition, isRecordingRule = false }) => {
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
          <FrameRow
            key={uniqueId()}
            frame={frame}
            index={pageStart + index}
            isAlertCondition={isAlertCondition}
            isRecordingRule={isRecordingRule}
          />
        ))}
      {emptyResults && (
        <div className={cx(styles.expression.noData, styles.mutedText)}>
          <Trans i18nKey="alerting.expression-result.no-data">No data</Trans>
        </div>
      )}
      {shouldShowPagination && (
        <div className={styles.pagination.wrapper} data-testid="paginate-expression">
          <Stack>
            <Button
              variant="secondary"
              fill="outline"
              onClick={previousPage}
              icon="angle-left"
              size="sm"
              aria-label={t('alerting.expression-result.aria-label-previouspage', 'previous-page')}
            />
            <Spacer />
            <span className={styles.mutedText}>
              <Trans i18nKey="" values={{ pageStart, pageEnd, numPages: series.length }}>
                {'{{pageStart}}'} - {'{{pageEnd}}'} of {'{{numPages}}'}
              </Trans>
            </span>
            <Spacer />
            <Button
              variant="secondary"
              fill="outline"
              onClick={nextPage}
              icon="angle-right"
              size="sm"
              aria-label={t('alerting.expression-result.aria-label-nextpage', 'next-page')}
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

  if (seriesCount === 0) {
    return (
      <span className={mutedText}>
        <Trans i18nKey="alerting.preview-summary.no-series">No series</Trans>
      </span>
    );
  }

  if (isCondition) {
    return <span className={mutedText}>{`${seriesCount} series: ${firing} firing, ${normal} normal`}</span>;
  }

  return <span className={mutedText}>{`${seriesCount} series`}</span>;
};

export function getGroupedByStateAndSeriesCount(series: DataFrame[]) {
  const noDataSeries = series.filter((serie) => getSeriesValue(serie) === undefined).length;
  const groupedByState = {
    // we need to filter out series with no data (undefined) or zero value
    [PromAlertingRuleState.Firing]: series.filter(
      (serie) => getSeriesValue(serie) !== undefined && getSeriesValue(serie) !== 0
    ),
    [PromAlertingRuleState.Inactive]: series.filter((serie) => getSeriesValue(serie) === 0),
  };

  const seriesCount = series.length - noDataSeries;

  return { groupedByState, seriesCount };
}

interface HeaderProps {
  refId: string;
  queryType: ExpressionQueryType;
  onUpdateRefId: (refId: string) => void;
  onRemoveExpression: () => void;
  onSetCondition: (refId: string) => void;
  query: ExpressionQuery;
  alertCondition: boolean;
}

const Header: FC<HeaderProps> = ({
  refId,
  queryType,
  onUpdateRefId,
  onRemoveExpression,
  onSetCondition,
  alertCondition,
  query,
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
        <Stack direction="row" gap={1} alignItems="center">
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
        <ExpressionStatusIndicator
          refId={refId}
          onSetCondition={() => onSetCondition(query.refId)}
          isCondition={alertCondition}
        />
        <IconButton
          name="trash-alt"
          variant="secondary"
          className={styles.mutedIcon}
          onClick={onRemoveExpression}
          tooltip={t('alerting.header.tooltip-remove', 'Remove expression "{{refId}}"', { refId })}
        />
      </Stack>
    </header>
  );
};

interface FrameProps extends Pick<ExpressionProps, 'isAlertCondition'> {
  frame: DataFrame;
  index: number;
  isRecordingRule?: boolean;
}

const OpeningBracket = () => <span>{'{'}</span>;
const ClosingBracket = () => <span>{'}'}</span>;
// eslint-disable-next-line @grafana/no-untranslated-strings
const Quote = () => <span>&quot;</span>;
const Equals = () => <span>{'='}</span>;

function FrameRow({ frame, index, isAlertCondition, isRecordingRule }: FrameProps) {
  const styles = useStyles2(getStyles);

  const name = getSeriesName(frame) || 'Series ' + index;
  const value = getSeriesValue(frame);
  const labelsRecord = getSeriesLabels(frame);
  const labels = Object.entries(labelsRecord);
  const hasLabels = labels.length > 0;

  const showFiring = isAlertCondition && value !== 0;
  const showNormal = isAlertCondition && value === 0;

  const title = `${hasLabels ? '' : name}${hasLabels ? `{${formatLabels(labelsRecord)}}` : ''}`;
  const shouldRenderSumary = !isRecordingRule;

  return (
    <div className={styles.expression.resultsRow}>
      <Stack direction="row" gap={1} alignItems="center">
        <div className={styles.expression.resultLabel} title={title}>
          <Text variant="code">
            {hasLabels ? (
              <>
                <OpeningBracket />
                {labels.map(([key, value], index) => (
                  <Text variant="body" key={uniqueId()}>
                    <span className={styles.expression.labelKey}>{key}</span>
                    <Equals />
                    <Quote />
                    <span className={styles.expression.labelValue}>{value}</span>
                    <Quote />
                    {index < labels.length - 1 && <span>, </span>}
                  </Text>
                ))}
                <ClosingBracket />
              </>
            ) : (
              <span className={styles.expression.labelKey}>{title}</span>
            )}
          </Text>
        </div>
        <div className={styles.expression.resultValue}>{formatSeriesValue(value)}</div>
        {shouldRenderSumary && (
          <>
            {showFiring && <AlertStateTag state={PromAlertingRuleState.Firing} size="sm" />}
            {showNormal && <AlertStateTag state={PromAlertingRuleState.Inactive} size="sm" />}
          </>
        )}
      </Stack>
    </div>
  );
}
interface TimeseriesRowProps extends Omit<FrameProps, 'isRecordingRule'> {}
const TimeseriesRow: FC<TimeseriesRowProps & { index: number }> = ({ frame, index }) => {
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
          <PopupCard
            placement="right"
            wrapperClassName={styles.timeseriesTableWrapper}
            content={
              <table className={styles.timeseriesTable}>
                <thead>
                  <tr>
                    <th>
                      <Trans i18nKey="alerting.timeseries-row.timestamp">Timestamp</Trans>
                    </th>
                    <th>
                      <Trans i18nKey="alerting.timeseries-row.value">Value</Trans>
                    </th>
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
            <span>
              <Trans i18nKey="alerting.timeseries-row.time-series-data">Time series data</Trans>
            </span>
          </PopupCard>
        </div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  expression: {
    wrapper: css({
      display: 'flex',
      border: `solid 1px ${theme.colors.border.medium}`,
      flex: 1,
      flexBasis: '400px',
      borderRadius: theme.shape.radius.default,
    }),
    stack: css({
      display: 'flex',
      flexDirection: 'column',
      flexWrap: 'nowrap',
      gap: 0,
      width: '100%',
      minWidth: '0', // this one is important to prevent text overflow
    }),
    classic: css({
      maxWidth: '100%',
    }),
    nonClassic: css({
      maxWidth: '640px',
    }),
    alertCondition: css({}),
    body: css({
      padding: theme.spacing(1),
      flex: 1,
    }),
    description: css({
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.size.xs,
      color: theme.colors.text.secondary,
    }),
    refId: css({
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.primary.text,
    }),
    results: css({
      display: 'flex',
      flexDirection: 'column',
      flexWrap: 'nowrap',

      borderTop: `solid 1px ${theme.colors.border.medium}`,
    }),
    noResults: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    resultsRow: css({
      padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,

      '&:nth-child(odd)': {
        backgroundColor: theme.colors.background.secondary,
      },

      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    labelKey: css({
      color: theme.isDark ? '#73bf69' : '#56a64b',
    }),
    labelValue: css({
      color: theme.isDark ? '#ce9178' : '#a31515',
    }),
    resultValue: css({
      textAlign: 'right',
    }),
    resultLabel: css({
      flex: 1,
      overflowX: 'auto',

      display: 'inline-block',
      whiteSpace: 'nowrap',
    }),
    noData: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(),
    }),
  },
  mutedText: css({
    color: theme.colors.text.secondary,
    fontSize: '0.9em',

    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  header: {
    wrapper: css({
      background: theme.colors.background.secondary,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderBottom: `solid 1px ${theme.colors.border.weak}`,
    }),
  },
  footer: css({
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),
    borderTop: `solid 1px ${theme.colors.border.weak}`,
  }),
  draggableIcon: css({
    cursor: 'grab',
  }),
  mutedIcon: css({
    color: theme.colors.text.secondary,
  }),
  editable: css({
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
  }),
  timeseriesTableWrapper: css({
    maxHeight: '500px',

    overflowY: 'scroll',
  }),
  timeseriesTable: css({
    tableLayout: 'auto',

    width: '100%',
    height: '100%',

    'td, th': {
      padding: theme.spacing(1),
    },

    td: {
      background: theme.colors.background.primary,
    },

    th: {
      background: theme.colors.background.secondary,
    },

    tr: {
      borderBottom: `1px solid ${theme.colors.border.medium}`,

      '&:last-of-type': {
        borderBottom: 'none',
      },
    },
  }),
  pagination: {
    wrapper: css({
      borderTop: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(),
    }),
  },
});
