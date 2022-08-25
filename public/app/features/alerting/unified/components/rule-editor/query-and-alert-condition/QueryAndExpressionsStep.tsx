import React, { FC, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import { LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, Button, Stack, Tooltip } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { AlertingQueryRunner } from '../../../state/AlertingQueryRunner';
import { RuleFormValues } from '../../../types/rule-form';
import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { ExpressionsEditor } from '../ExpressionsEditor';
import { RuleEditorSection } from '../RuleEditorSection';

import { AlertType } from './AlertType';
import { Query } from './Query';
import { queriesAndExpressionsReducer } from './reducer';

interface Props {
  editingExistingRule: boolean;
}

export const QueryAndExpressionsStep: FC<Props> = ({ editingExistingRule }) => {
  const runner = useRef(new AlertingQueryRunner());
  const { setValue, getValues, watch } = useFormContext<RuleFormValues>();

  const initialState = {
    queries: getValues('queries'),
    panelData: {},
  };
  const [{ queries, panelData }, dispatch] = useReducer(queriesAndExpressionsReducer, initialState);

  const condition = watch('condition');

  const cancelQueries = useCallback(() => {
    runner.current.cancel();
  }, []);

  const runQueries = useCallback(() => {
    runner.current.run(queries);
  }, [queries]);

  // whenever we update the queries we have to update the form too
  useEffect(() => {
    setValue('queries', queries, { shouldValidate: false });
    runQueries();
  }, [queries, runQueries, setValue]);

  // set up the AlertQueryRunner
  useEffect(() => {
    const currentRunner = runner.current;

    runner.current.get().subscribe((data) => {
      dispatch({ type: 'updatePanelData', payload: data });
    });

    return () => currentRunner.destroy();
  }, []);

  const noCompatibleDataSources = getDefaultOrFirstCompatibleDataSource() === undefined;

  const isDataLoading = useMemo(() => {
    return Object.values(panelData).some((d) => d.state === LoadingState.Loading);
  }, [panelData]);

  // data queries only
  const dataQueries = useMemo(() => {
    return queries.filter((query) => !isExpressionQuery(query.model));
  }, [queries]);

  const emptyQueries = queries.length === 0;

  return (
    <RuleEditorSection stepNo={1} title="Set a query and alert condition">
      <AlertType editingExistingRule={editingExistingRule} />
      <Stack direction="column">
        {/* Data Queries */}
        <Query
          queries={dataQueries}
          panelData={panelData}
          condition={condition}
          onSetCondition={(refId) => {
            setValue('condition', refId);
          }}
          // we dont use this prop (onRunQueries) as it's kinda doing funky things, we just call "runQueries" when we receive new queries
          onChangeQueries={(queries) => {
            dispatch({ type: 'setDataQueries', payload: queries });
          }}
        />
        {/* Expression Queries */}
        <ExpressionsEditor
          queries={queries}
          panelData={panelData}
          condition={condition}
          onSetCondition={(refId) => {
            setValue('condition', refId);
          }}
          onNewExpression={() => {
            dispatch({ type: 'addNewExpression' });
          }}
          onRemoveExpression={(refId) => {
            dispatch({ type: 'removeExpression', payload: refId });
          }}
          onUpdateRefId={(oldRefId, newRefId) => {
            dispatch({ type: 'updateExpressionRefId', payload: { oldRefId, newRefId } });
          }}
          onUpdateExpressionType={(refId, type) => {
            dispatch({ type: 'updateExpressionType', payload: { refId, type } });
          }}
          onUpdateQueryExpression={(model) => {
            dispatch({ type: 'updateExpression', payload: model });
          }}
        />
        {/* action buttons */}
        <Stack direction="row">
          <Tooltip content={'You appear to have no compatible data sources'} show={noCompatibleDataSources}>
            <Button
              type="button"
              icon="plus"
              onClick={() => {
                dispatch({ type: 'addNewDataQuery' });
              }}
              variant="secondary"
              aria-label={selectors.components.QueryTab.addQuery}
              disabled={noCompatibleDataSources}
            >
              Add query
            </Button>
          </Tooltip>

          {isDataLoading && (
            <Button icon="fa fa-spinner" type="button" variant="destructive" onClick={cancelQueries}>
              Cancel
            </Button>
          )}
          {!isDataLoading && (
            <Button icon="sync" type="button" onClick={() => runQueries()} disabled={emptyQueries}>
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
    </RuleEditorSection>
  );
};
