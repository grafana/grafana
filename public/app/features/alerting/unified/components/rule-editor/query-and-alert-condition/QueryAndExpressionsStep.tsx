import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, getDefaultRelativeTimeRange, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, Dropdown, Field, Icon, InputControl, Menu, MenuItem, Tooltip, useStyles2 } from '@grafana/ui';
import { H5 } from '@grafana/ui/src/unstable';
import { contextSrv } from 'app/core/core';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType, expressionTypes } from 'app/features/expressions/types';
import { AccessControlAction, useDispatch } from 'app/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { DataSourceJsonData } from '../../../../../../../../packages/grafana-data/compiled/types/datasource';
import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { fetchAllPromBuildInfoAction } from '../../../state/actions';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { isPromOrLokiQuery } from '../../../utils/rule-form';
import { ExpressionEditor } from '../ExpressionEditor';
import { ExpressionsEditor } from '../ExpressionsEditor';
import { NeedHelpInfo } from '../NeedHelpInfo';
import { QueryEditor } from '../QueryEditor';
import { RecordingRuleEditor } from '../RecordingRuleEditor';
import { RuleEditorSection } from '../RuleEditorSection';
import { errorFromSeries, refIdExists } from '../util';

import { CloudDataSourceSelector } from './CloudDataSourceSelector';
import {
  addNewDataQuery,
  addNewExpression,
  duplicateQuery,
  queriesAndExpressionsReducer,
  removeExpression,
  rewireExpressions,
  setDataQueries,
  setRecordingRulesQueries,
  updateExpression,
  updateExpressionRefId,
  updateExpressionTimeRange,
  updateExpressionType,
} from './reducer';
import { useAlertQueryRunner } from './useAlertQueryRunner';

interface Props {
  editingExistingRule: boolean;
  onDataChange: (error: string) => void;
}

export const QueryAndExpressionsStep = ({ editingExistingRule, onDataChange }: Props) => {
  const {
    setValue,
    getValues,
    watch,
    formState: { errors },
    control,
  } = useFormContext<RuleFormValues>();

  const { queryPreviewData, runQueries, cancelQueries, isPreviewLoading, clearPreviewData } = useAlertQueryRunner();

  const initialState = {
    queries: getValues('queries'),
  };

  const [{ queries }, dispatch] = useReducer(queriesAndExpressionsReducer, initialState);
  const [type, condition, dataSourceName] = watch(['type', 'condition', 'dataSourceName']);

  const isGrafanaManagedType = type === RuleFormType.grafana;
  const isRecordingRuleType = type === RuleFormType.cloudRecording;
  const isCloudAlertRuleType = type === RuleFormType.cloudAlerting;

  const dispatch_ = useDispatch();
  useEffect(() => {
    dispatch_(fetchAllPromBuildInfoAction());
  }, [dispatch_]);

  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const runQueriesPreview = useCallback(() => {
    runQueries(getValues('queries'));
  }, [runQueries, getValues]);

  // whenever we update the queries we have to update the form too
  useEffect(() => {
    setValue('queries', queries, { shouldValidate: false });
  }, [queries, runQueries, setValue]);

  const noCompatibleDataSources = getDefaultOrFirstCompatibleDataSource() === undefined;

  // data queries only
  const dataQueries = useMemo(() => {
    return queries.filter((query) => !isExpressionQuery(query.model));
  }, [queries]);

  // expression queries only
  const expressionQueries = useMemo(() => {
    return queries.filter((query) => isExpressionQuery(query.model));
  }, [queries]);

  const emptyQueries = queries.length === 0;

  useEffect(() => {
    const currentCondition = getValues('condition');

    if (!currentCondition || RuleFormType.cloudRecording) {
      return;
    }

    const error = errorFromSeries(queryPreviewData[currentCondition]?.series || []);
    onDataChange(error?.message || '');
  }, [queryPreviewData, getValues, onDataChange]);

  const handleSetCondition = useCallback(
    (refId: string | null) => {
      if (!refId) {
        return;
      }

      runQueriesPreview(); //we need to run the queries to know if the condition is valid

      setValue('condition', refId);
    },
    [runQueriesPreview, setValue]
  );

  const onUpdateRefId = useCallback(
    (oldRefId: string, newRefId: string) => {
      const newRefIdExists = refIdExists(queries, newRefId);
      // TODO we should set an error and explain what went wrong instead of just refusing to update
      if (newRefIdExists) {
        return;
      }

      dispatch(updateExpressionRefId({ oldRefId, newRefId }));

      // update condition too if refId was updated
      if (condition === oldRefId) {
        handleSetCondition(newRefId);
      }
    },
    [condition, queries, handleSetCondition]
  );

  const onChangeQueries = useCallback(
    (updatedQueries: AlertQuery[]) => {
      // Most data sources triggers onChange and onRunQueries consecutively
      // It means our reducer state is always one step behind when runQueries is invoked
      // Invocation cycle => onChange -> dispatch(setDataQueries) -> onRunQueries -> setDataQueries Reducer
      // As a workaround we update form values as soon as possible to avoid stale state
      // This way we can access up to date queries in runQueriesPreview without waiting for re-render
      setValue('queries', updatedQueries, { shouldValidate: false });

      // update data source name and expression if it's been changed in the queries from the reducer when prom or loki query
      const query = updatedQueries[0];
      if (isPromOrLokiQuery(query.model)) {
        const dataSourceSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        if (!dataSourceSettings) {
          throw new Error('The Data source has not been defined.');
        }

        const expression = query.model.expr;

        setValue('dataSourceName', dataSourceSettings.name);
        setValue('expression', expression);
      }

      dispatch(setDataQueries(updatedQueries));
      dispatch(updateExpressionTimeRange());
      // check if we need to rewire expressions
      updatedQueries.forEach((query, index) => {
        const oldRefId = queries[index].refId;
        const newRefId = query.refId;

        if (oldRefId !== newRefId) {
          dispatch(rewireExpressions({ oldRefId, newRefId }));
        }
      });
    },
    [queries, setValue]
  );

  const onChangeRecordingRulesQueries = useCallback(
    (updatedQueries: AlertQuery[]) => {
      const query = updatedQueries[0];

      const dataSourceSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
      if (!dataSourceSettings) {
        throw new Error('The Data source has not been defined.');
      }

      if (!isPromOrLokiQuery(query.model)) {
        return;
      }

      const expression = query.model.expr;

      setValue('queries', updatedQueries, { shouldValidate: false });
      setValue('dataSourceName', dataSourceSettings.name);
      setValue('expression', expression);

      dispatch(setRecordingRulesQueries({ recordingRuleQueries: updatedQueries, expression }));
      runQueriesPreview();
    },
    [runQueriesPreview, setValue]
  );

  const recordingRuleDefaultDatasource = rulesSourcesWithRuler[0];

  useEffect(() => {
    clearPreviewData();
    if (type === RuleFormType.cloudRecording) {
      const expr = getValues('expression');

      if (!recordingRuleDefaultDatasource) {
        return;
      }

      const datasourceUid =
        (editingExistingRule && getDataSourceSrv().getInstanceSettings(dataSourceName)?.uid) ||
        recordingRuleDefaultDatasource.uid;

      const defaultQuery = {
        refId: 'A',
        datasourceUid,
        queryType: '',
        relativeTimeRange: getDefaultRelativeTimeRange(),
        expr,
        model: {
          refId: 'A',
          hide: false,
          expr,
        },
      };
      dispatch(setRecordingRulesQueries({ recordingRuleQueries: [defaultQuery], expression: expr }));
    }
  }, [type, recordingRuleDefaultDatasource, editingExistingRule, getValues, dataSourceName, clearPreviewData]);

  const onDuplicateQuery = useCallback((query: AlertQuery) => {
    dispatch(duplicateQuery(query));
  }, []);

  // update the condition if it's been removed
  useEffect(() => {
    if (!refIdExists(queries, condition)) {
      const lastRefId = queries.at(-1)?.refId ?? null;
      handleSetCondition(lastRefId);
    }
  }, [condition, queries, handleSetCondition]);

  const onClickType = useCallback(
    (type: ExpressionQueryType) => {
      dispatch(addNewExpression(type));
    },
    [dispatch]
  );

  const styles = useStyles2(getStyles);

  return (
    <RuleEditorSection stepNo={2} title="Define query and alert condition">
      {/* This is the cloud data source selector */}
      {type === RuleFormType.cloudRecording ||
        (type === RuleFormType.cloudAlerting && <CloudDataSourceSelector dataSourceSelected={dataSourceName} />)}

      {/* This is the PromQL Editor for recording rules */}
      {isRecordingRuleType && dataSourceName && (
        <Field error={errors.expression?.message} invalid={!!errors.expression?.message}>
          <RecordingRuleEditor
            dataSourceName={dataSourceName}
            queries={queries}
            runQueries={runQueriesPreview}
            onChangeQuery={onChangeRecordingRulesQueries}
            panelData={queryPreviewData}
          />
        </Field>
      )}

      {/* This is the PromQL Editor for Cloud rules */}
      {isCloudAlertRuleType && dataSourceName && (
        <Field error={errors.expression?.message} invalid={!!errors.expression?.message}>
          <InputControl
            name="expression"
            render={({ field: { ref, ...field } }) => {
              const expression =
                !editingExistingRule && queries[0]?.model
                  ? isPromOrLokiQuery(queries[0]?.model)
                    ? queries[0]?.model.expr
                    : undefined
                  : undefined;
              if (!editingExistingRule) {
                getValues('expression') !== expression && expression && setValue('expression', expression);
              }
              return (
                <ExpressionEditor
                  {...field}
                  value={expression ?? field.value}
                  dataSourceName={dataSourceName}
                  showPreviewAlertsButton={!isRecordingRuleType}
                />
              );
            }}
            control={control}
            rules={{
              required: { value: true, message: 'A valid expression is required' },
            }}
          />
        </Field>
      )}

      {/* This is the editor for Grafana managed rules */}
      {isGrafanaManagedType && (
        <Stack direction="column">
          {/* Data Queries */}
          <Stack direction="row" gap={1} alignItems="baseline">
            <div className={styles.mutedText}>
              Define queries and/or expressions and then choose one of them as the alert rule condition. This is the
              threshold that an alert rule must meet or exceed in order to fire.
            </div>

            <NeedHelpInfo
              contentText={`An alert rule consists of one or more queries and expressions that select the data you want to measure.
          Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire.
          For more information on queries and expressions, see Query and transform data.`}
              externalLink={`https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/`}
              linkText={`Read about query and condition`}
              title="Define query and alert condition"
            />
          </Stack>

          <QueryEditor
            queries={dataQueries}
            expressions={expressionQueries}
            onRunQueries={runQueriesPreview}
            onChangeQueries={onChangeQueries}
            onDuplicateQuery={onDuplicateQuery}
            panelData={queryPreviewData}
            condition={condition}
            onSetCondition={handleSetCondition}
          />
          <Tooltip content={'You appear to have no compatible data sources'} show={noCompatibleDataSources}>
            <Button
              type="button"
              onClick={() => {
                dispatch(addNewDataQuery());
              }}
              variant="secondary"
              aria-label={selectors.components.QueryTab.addQuery}
              disabled={noCompatibleDataSources}
              className={styles.addQueryButton}
            >
              Add query
            </Button>
          </Tooltip>
          {/* Expression Queries */}
          <H5>Expressions</H5>
          <div className={styles.mutedText}>Manipulate data returned from queries with math and other operations</div>
          <ExpressionsEditor
            queries={queries}
            panelData={queryPreviewData}
            condition={condition}
            onSetCondition={handleSetCondition}
            onRemoveExpression={(refId) => {
              dispatch(removeExpression(refId));
            }}
            onUpdateRefId={onUpdateRefId}
            onUpdateExpressionType={(refId, type) => {
              dispatch(updateExpressionType({ refId, type }));
            }}
            onUpdateQueryExpression={(model) => {
              dispatch(updateExpression(model));
            }}
          />
          {/* action buttons */}
          <Stack direction="row">
            {config.expressionsEnabled && <TypeSelectorButton onClickType={onClickType} />}

            {isPreviewLoading && (
              <Button icon="fa fa-spinner" type="button" variant="destructive" onClick={cancelQueries}>
                Cancel
              </Button>
            )}
            {!isPreviewLoading && (
              <Button icon="sync" type="button" onClick={runQueriesPreview} disabled={emptyQueries}>
                Preview
              </Button>
            )}
          </Stack>

          {/* No Queries */}
          {emptyQueries && (
            <Alert title="No queries or expressions have been configured" severity="warning">
              Create at least one query or expression to be alerted on
            </Alert>
          )}
        </Stack>
      )}
      <SmartAlertTypeDetector
        editingExistingRule={editingExistingRule}
        rulesSourcesWithRuler={rulesSourcesWithRuler}
        queries={queries}
      />
    </RuleEditorSection>
  );
};

function getAvailableRuleTypes() {
  const canCreateGrafanaRules = contextSrv.hasAccess(
    AccessControlAction.AlertingRuleCreate,
    contextSrv.hasEditPermissionInFolders
  );
  const canCreateCloudRules = contextSrv.hasAccess(AccessControlAction.AlertingRuleExternalWrite, contextSrv.isEditor);
  const defaultRuleType = canCreateGrafanaRules ? RuleFormType.grafana : RuleFormType.cloudAlerting;

  const enabledRuleTypes: RuleFormType[] = [];
  if (canCreateGrafanaRules) {
    enabledRuleTypes.push(RuleFormType.grafana);
  }
  if (canCreateCloudRules) {
    enabledRuleTypes.push(RuleFormType.cloudAlerting, RuleFormType.cloudRecording);
  }

  return { enabledRuleTypes, defaultRuleType };
}

function SmartAlertTypeDetector({
  editingExistingRule,
  rulesSourcesWithRuler,
  queries,
}: {
  editingExistingRule: boolean;
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  queries: AlertQuery[];
}) {
  const { getValues, setValue } = useFormContext<RuleFormValues>();

  const ruleFormType = getValues('type');
  const styles = useStyles2(getStyles);

  // get available rule types
  const availableRuleTypes = getAvailableRuleTypes();
  // check if we have only one query in queries and if it's a cloud datasource
  const dataSourceIdFromQueries = queries.length === 1 ? queries[0]?.datasourceUid : '';
  const isRecordingRuleType = ruleFormType === RuleFormType.cloudRecording;
  // it's a smart type if we are creating a new rule and it's not a recording rule type
  const showSmartTypeSwitch = !editingExistingRule && !isRecordingRuleType;
  //let's check if we have a smart cloud type
  const canBeCloud =
    showSmartTypeSwitch &&
    queries.length === 1 &&
    rulesSourcesWithRuler.some(
      (dsJsonData: DataSourceInstanceSettings<DataSourceJsonData>) => dsJsonData.uid === dataSourceIdFromQueries
    );
  // check for enabled types
  const grafanaTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.grafana);
  const cloudTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.cloudAlerting);
  // can we switch to the other type? (cloud or grafana)
  const canSwitch =
    !editingExistingRule &&
    !isRecordingRuleType &&
    ((cloudTypeEnabled && canBeCloud && ruleFormType === RuleFormType.grafana) ||
      (ruleFormType === RuleFormType.cloudAlerting && grafanaTypeEnabled));

  // we don't show any alert box if this is a recording rule
  if (isRecordingRuleType) {
    return null;
  }

  const switchType = () => {
    const typeInForm = getValues('type');
    if (typeInForm === RuleFormType.cloudAlerting) {
      setValue('type', RuleFormType.grafana);
    } else {
      setValue('type', RuleFormType.cloudAlerting);
    }
  };

  // texts and labels for the alert box
  const typeTitle = ruleFormType === RuleFormType.cloudAlerting ? 'Cloud alert rule' : 'Grafana-managed alert rule';
  const typeLabel = ruleFormType === RuleFormType.cloudAlerting ? 'Cloud' : 'Grafana-managed';
  const switchToLabel = ruleFormType !== RuleFormType.cloudAlerting ? 'Cloud' : 'Grafana-managed';
  const contentText =
    ruleFormType === RuleFormType.cloudAlerting
      ? 'Grafana-managed alert rules are stored in the Grafana database and are managed by Grafana.'
      : 'Cloud alert rules are stored in the Grafana Cloud database and are managed by Grafana Cloud.';
  const titleLabel = `Based on the selected data sources this alert rule will be ${typeLabel}`;

  return (
    <div className={styles.alert}>
      <Alert severity="info" title={typeTitle}>
        <Stack gap={1} direction="row" alignItems={'center'}>
          {!editingExistingRule && titleLabel}
          <NeedHelpInfo
            contentText={contentText}
            externalLink={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/`}
            linkText={`Read about alert rule types`}
            title=" Alert rule types"
          />

          {canSwitch && (
            <Button type="button" onClick={switchType} variant="secondary" className={styles.switchButton}>
              Switch to {switchToLabel} alert rule
            </Button>
          )}
        </Stack>
      </Alert>
    </div>
  );
}

function TypeSelectorButton({ onClickType }: { onClickType: (type: ExpressionQueryType) => void }) {
  const newMenu = (
    <Menu>
      {expressionTypes.map((type) => (
        <Tooltip key={type.value} content={type.description ?? ''} placement="right">
          <MenuItem
            key={type.value}
            onClick={() => onClickType(type.value ?? ExpressionQueryType.math)}
            label={type.label ?? ''}
          />
        </Tooltip>
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={newMenu}>
      <Button variant="secondary">
        Add expression
        <Icon name="angle-down" />
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  switchButton: css`
    margin-left: ${theme.spacing(1)};
  `,
  alert: css`
    margin-top: ${theme.spacing(2)};
  `,
  mutedText: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
    margin-top: ${theme.spacing(-1)};
  `,
  addQueryButton: css`
    width: fit-content;
  `,
  helpInfo: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    width: fit-content;
    font-weight: ${theme.typography.fontWeightMedium};
    margin-left: ${theme.spacing(1)};
    font-size: ${theme.typography.size.sm};
    cursor: pointer;
  `,
  helpInfoText: css`
    margin-left: ${theme.spacing(0.5)};
    text-decoration: underline;
  `,
  infoLink: css`
    color: ${theme.colors.text.link};
  `,
});
