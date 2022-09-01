import { css, cx } from '@emotion/css';
import { capitalize, uniqueId } from 'lodash';
import React, { FC, useCallback, useState } from 'react';

import { DataFrame, GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { AutoSizeInput, Icon, IconButton, Select, Stack, useStyles2 } from '@grafana/ui';
import { ClassicConditions } from 'app/features/expressions/components/ClassicConditions';
import { Math } from 'app/features/expressions/components/Math';
import { Reduce } from 'app/features/expressions/components/Reduce';
import { Resample } from 'app/features/expressions/components/Resample';
import { ExpressionQuery, ExpressionQueryType, gelTypes } from 'app/features/expressions/types';
import { AlertQuery, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertStateTag } from '../rules/AlertStateTag';

import { AlertCondition } from './AlertCondition';
import { getSeriesName, getSeriesValue } from './util';

interface ExpressionProps {
  isAlertCondition?: boolean;
  data?: PanelData;
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
  const emptyResults = hasResults && series.length === 0;

  const alertCondition = isAlertCondition ?? false;
  const showSummary = isAlertCondition && hasResults;

  const groupedByState = {
    [PromAlertingRuleState.Firing]: series.filter((serie) => getSeriesValue(serie) >= 1),
    [PromAlertingRuleState.Inactive]: series.filter((serie) => getSeriesValue(serie) < 1),
  };

  const renderExpressionType = useCallback(
    (query: ExpressionQuery) => {
      // these are the refs we can choose from that don't include the current one
      const availableRefIds = queries!
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

        default:
          return <>Expression not supported: {query.type}</>;
      }
    },
    [onChangeQuery, queries]
  );

  return (
    <div className={cx(styles.expression.wrapper, alertCondition && styles.expression.alertCondition)}>
      <div className={styles.expression.stack}>
        <Header
          refId={query.refId}
          queryType={queryType}
          onRemoveExpression={() => onRemoveExpression(query.refId)}
          onUpdateRefId={(newRefId) => onUpdateRefId(query.refId, newRefId)}
          onUpdateExpressionType={(type) => onUpdateExpressionType(query.refId, type)}
        />
        <div className={styles.expression.body}>{renderExpressionType(query)}</div>
        {hasResults && (
          <div className={styles.expression.results}>
            {series.map((frame) => (
              // There's no way to uniquely identify a frame that doesn't cause render bugs :/ (Gilles)
              <FrameRow key={uniqueId()} frame={frame} isAlertCondition={alertCondition} />
            ))}
            {emptyResults && <div className={cx(styles.expression.noData, styles.mutedText)}>No data</div>}
          </div>
        )}
        <div className={styles.footer}>
          <Stack direction="row" alignItems="center">
            <AlertCondition onSetCondition={() => onSetCondition(query.refId)} enabled={alertCondition} />
            <Spacer />
            {showSummary && (
              <PreviewSummary
                firing={groupedByState[PromAlertingRuleState.Firing].length}
                normal={groupedByState[PromAlertingRuleState.Inactive].length}
              />
            )}
          </Stack>
        </div>
      </div>
    </div>
  );
};

const PreviewSummary: FC<{ firing: number; normal: number }> = ({ firing, normal }) => {
  const { mutedText } = useStyles2(getStyles);
  return <span className={mutedText}>{`${firing} firing, ${normal} normal`}</span>;
};

interface HeaderProps {
  refId: string;
  queryType: ExpressionQueryType;
  onUpdateRefId: (refId: string) => void;
  onRemoveExpression: () => void;
  onUpdateExpressionType: (type: ExpressionQueryType) => void;
}

const Header: FC<HeaderProps> = ({ refId, queryType, onUpdateRefId, onUpdateExpressionType, onRemoveExpression }) => {
  const styles = useStyles2(getStyles);
  const [editMode, setEditMode] = useState<'refId' | 'expressionType' | false>(false);

  const editing = editMode !== false;
  const editingRefId = editing && editMode === 'refId';
  const editingType = editing && editMode === 'expressionType';

  const selectedExpressionType = gelTypes.find((o) => o.value === queryType);

  return (
    <header className={styles.header.wrapper}>
      <Stack direction="row" gap={0.5} alignItems="center">
        <Stack direction="row" gap={1} alignItems="center" wrap={false}>
          {!editingRefId && (
            <div className={styles.editable} onClick={() => setEditMode('refId')}>
              <div className={styles.expression.refId}>{refId}</div>
            </div>
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
          {!editingType && (
            <div className={styles.editable} onClick={() => setEditMode('expressionType')}>
              <div className={styles.mutedText}>{capitalize(queryType)}</div>
              <Icon size="xs" name="pen" className={styles.mutedIcon} onClick={() => setEditMode('expressionType')} />
            </div>
          )}
          {editingType && (
            <Select
              isOpen
              autoFocus
              onChange={(selection) => {
                onUpdateExpressionType(selection.value ?? ExpressionQueryType.classic);
                setEditMode(false);
              }}
              onBlur={() => {
                setEditMode(false);
              }}
              options={gelTypes}
              value={selectedExpressionType}
              width={25}
            />
          )}
        </Stack>
        <Spacer />
        <IconButton name="trash-alt" variant="secondary" className={styles.mutedIcon} onClick={onRemoveExpression} />
      </Stack>
    </header>
  );
};

interface FrameProps extends Pick<ExpressionProps, 'isAlertCondition'> {
  frame: DataFrame;
}

const FrameRow: FC<FrameProps> = ({ frame, isAlertCondition }) => {
  const styles = useStyles2(getStyles);

  const name = getSeriesName(frame);
  const value = getSeriesValue(frame);

  const showFiring = isAlertCondition && value !== 0;
  const showNormal = isAlertCondition && value === 0;

  return (
    <div className={styles.expression.resultsRow}>
      <Stack direction="row" gap={1} alignItems="center">
        <span className={cx(styles.mutedText, styles.expression.resultLabel)} title={name}>
          {name}
        </span>
        {/* TODO format the values with american notation or SI notation? */}
        <div className={styles.expression.resultValue}>{value}</div>
        {showFiring && <AlertStateTag state={PromAlertingRuleState.Firing} size="sm" />}
        {showNormal && <AlertStateTag state={PromAlertingRuleState.Inactive} size="sm" />}
      </Stack>
    </div>
  );
};

// TODO: move this to design system or util file?
const Spacer = () => <span style={{ flex: 1 }}></span>;

const getStyles = (theme: GrafanaTheme2) => ({
  expression: {
    wrapper: css`
      display: flex;
      border: solid 1px ${theme.colors.border.medium};

      border-radius: ${theme.shape.borderRadius()};
      max-width: 640px;
    `,
    stack: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 0;
      min-width: 0; // this one is important to prevent text overflow
    `,
    alertCondition: css``,
    body: css`
      padding: ${theme.spacing(1)};
      flex: 1;
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.primary.text};
    `,
    results: css`
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
    resultValue: css`
      color: ${theme.colors.text.maxContrast};
      text-align: right;
    `,
    resultLabel: css`
      flex: 1;
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
      border-bottom: solid 1px ${theme.colors.border.medium};
    `,
  },
  footer: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    border-top: solid 1px ${theme.colors.border.medium};
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
});
