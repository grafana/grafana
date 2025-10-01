/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */

import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isExpressionQueryInAlert } from '../../../../rule-editor/formProcessing';
import { RuleFormValues } from '../../../../types/rule-form';
import { NeedHelpInfo } from '../../NeedHelpInfo';
import { QueryEditor } from '../../QueryEditor';
import {
  SimpleCondition,
  SimpleConditionEditor,
  getSimpleConditionFromExpressions,
} from '../../query-and-alert-condition/SimpleCondition';
import { addNewDataQuery, queriesAndExpressionsReducer } from '../../query-and-alert-condition/reducer';
import { useAlertQueryRunner } from '../../query-and-alert-condition/useAlertQueryRunner';

import { getSimplifiedSectionStyles } from './sectionStyles';

export function QueryAndExpressionSection({ sparkJoy }: { sparkJoy?: boolean }) {
  const base = useStyles2(getSimplifiedSectionStyles);
  const styles = useStyles2(getStyles);
  const { getValues, setValue } = useFormContext<RuleFormValues>();
  const initialState = useMemo(() => ({ queries: getValues('queries') as AlertQuery[] }), [getValues]);
  const [{ queries }, dispatch] = useReducer(queriesAndExpressionsReducer, initialState);
  const { queryPreviewData, runQueries, cancelQueries, isPreviewLoading } = useAlertQueryRunner();
  const [condition, setCondition] = useState<string | null>(getValues('condition'));

  const dataQueries = useMemo(() => queries.filter((q: AlertQuery) => !isExpressionQuery(q.model)), [queries]);
  const expressionQueries = useMemo(() => queries.filter((q: AlertQuery) => isExpressionQueryInAlert(q)), [queries]);
  const [simpleConditionState, setSimpleConditionState] = useState<SimpleCondition>(() =>
    getSimpleConditionFromExpressions(expressionQueries as Array<AlertQuery<ExpressionQuery>>)
  );
  useEffect(() => {
    setSimpleConditionState(getSimpleConditionFromExpressions(expressionQueries as Array<AlertQuery<ExpressionQuery>>));
  }, [expressionQueries]);
  const emptyQueries = queries.length === 0;
  const simplifiedQueryStep = false;
  const noCompatibleDataSources = false;

  const runQueriesPreview = useCallback(
    (cnd?: string) => {
      runQueries(getValues('queries'), cnd || condition || '');
    },
    [runQueries, getValues, condition]
  );

  const onChangeQueries = useCallback(
    (qs: AlertQuery[]) => {
      setValue('queries', qs);
    },
    [setValue]
  );

  const onDuplicateQuery = useCallback((q: AlertQuery) => {}, []);
  const handleSetCondition = useCallback((c: string) => setCondition(c), []);
  return (
    <div className={base.section}>
      <div className={base.sectionHeaderRow}>
        <span className={base.stepBadge}>
          <Trans i18nKey="alerting.simplified.step-number-two">2</Trans>
        </span>
        <div className={base.sectionHeader}>
          <Trans i18nKey="alerting.simplified.query-and-expressions">Query and expressions</Trans>
        </div>
      </div>
      <div className={base.contentIndented}>
        <Stack direction="column">
          <Stack direction="row" gap={0.5} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.simplified.query-and-expressions.help-text">
                Define query and alert condition
              </Trans>
            </Text>
            <NeedHelpInfo
              contentText={t(
                'alerting.simplified.query-and-expressions.help-content',
                'An alert rule consists of one or more queries and expressions that select the data you want to measure. Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire. For more information on queries and expressions, see Query and transform data.'
              )}
              externalLink="https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/"
              linkText={t(
                'alerting.simplified.query-and-expressions.link-text',
                'Read more on our documentation website'
              )}
              title={t('alerting.simplified.query-and-expressions.title', 'Define query and alert condition')}
            />
          </Stack>
          <QueryEditor
            queries={dataQueries}
            expressions={expressionQueries}
            onRunQueries={() => runQueriesPreview()}
            onChangeQueries={onChangeQueries}
            onDuplicateQuery={onDuplicateQuery}
            panelData={queryPreviewData}
            condition={condition}
            onSetCondition={handleSetCondition}
            sparkJoy={sparkJoy}
          />
          {!simplifiedQueryStep && (
            <div className={styles.spacedAfter}>
              <Stack direction="row" alignItems="center">
                <Tooltip
                  content={t(
                    'alerting.query-and-expressions-step.no-compatible-sources',
                    'You appear to have no compatible data sources'
                  )}
                  show={noCompatibleDataSources}
                >
                  <Button
                    type="button"
                    onClick={() => {
                      dispatch(addNewDataQuery());
                    }}
                    variant="secondary"
                    data-testid={selectors.components.QueryTab.addQuery}
                    disabled={noCompatibleDataSources}
                  >
                    <Trans i18nKey="alerting.query-and-expressions-step.add-query">Add query</Trans>
                  </Button>
                </Tooltip>
              </Stack>
            </div>
          )}
          {/* action buttons */}
          <Stack direction="column">
            <SimpleConditionEditor
              simpleCondition={simpleConditionState}
              onChange={setSimpleConditionState}
              expressionQueriesList={expressionQueries as Array<AlertQuery<ExpressionQuery>>}
              dispatch={dispatch as any}
              previewData={queryPreviewData[condition ?? '']}
            />
            <Stack direction="row">
              {isPreviewLoading && (
                <Button icon="spinner" type="button" variant="destructive" onClick={cancelQueries}>
                  <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
                </Button>
              )}
              {!isPreviewLoading && (
                <Button
                  data-testid={selectors.components.AlertRules.previewButton}
                  icon="sync"
                  type="button"
                  onClick={() => runQueriesPreview()}
                  disabled={emptyQueries}
                >
                  {t('alerting.queryAndExpressionsStep.preview', 'Preview')}
                </Button>
              )}
            </Stack>
          </Stack>

          {/* No Queries */}
          {emptyQueries && (
            <Alert
              title={t(
                'alerting.query-and-expressions-step.title-queries-expressions-configured',
                'No queries or expressions have been configured'
              )}
              severity="warning"
            >
              <Trans i18nKey="alerting.query-and-expressions-step.body-queries-expressions-configured">
                Create at least one query or expression to be alerted on
              </Trans>
            </Alert>
          )}
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({ width: '100%' }),
    sectionHeaderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      fontWeight: 600,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    stepBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      width: 20,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 600,
    }),
    spacedAfter: css({ marginBottom: theme.spacing(2) }),
  };
}
