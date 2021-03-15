import { css } from 'emotion';
import { DataSourceInstanceSettings, GrafanaTheme } from '@grafana/data';
import { Alert, LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { FC, useEffect, useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useDispatch } from 'react-redux';
import { fetchRulesAction } from '../../state/actions';
import { RulesGroup } from './RulesGroup';
import { getRulesDatasources } from '../../utils/datasource';
import { RuleNamespace } from 'app/types/unified-alerting/internal';
import { SerializedError } from '@reduxjs/toolkit';
import pluralize from 'pluralize';

export const SystemOrApplicationAlerts: FC = () => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const rules = useUnifiedAlertingSelector((state) => state.rules);
  const rulesDatasources = useMemo(getRulesDatasources, []);

  // trigger fetch for any rules sources that dont have results and are not currently loading
  useEffect(() => {
    rulesDatasources.forEach((ds) => {
      const { dispatched } = rules[ds.name] || {};
      if (!dispatched) {
        console.log('fetchin', rules[ds.name]);
        dispatch(fetchRulesAction(ds.name));
      }
    });
  }, [rulesDatasources, rules]);

  const namespaces = useMemo(
    (): Array<{ namespace: RuleNamespace; datasource: DataSourceInstanceSettings }> =>
      rulesDatasources
        .map((datasource) => rules[datasource.name]?.result?.map((namespace) => ({ namespace, datasource })) || [])
        .flat()
        .sort((a, b) => a.namespace.name.localeCompare(b.namespace.name)),
    [rules, rulesDatasources]
  );

  const errors = useMemo(
    () =>
      rulesDatasources.reduce<Array<{ error: SerializedError; datasource: DataSourceInstanceSettings }>>(
        (result, datasource) => {
          const error = rules[datasource.name]?.error;
          if (error) {
            return [...result, { datasource, error }];
          }
          return result;
        },
        []
      ),
    [rules, rulesDatasources]
  );

  const datasourcesLoading = useMemo(() => rulesDatasources.filter((ds) => rules[ds.name]?.loading), [
    rules,
    rulesDatasources,
  ]);

  return (
    <section className={styles.wrapper}>
      <h5>System or application</h5>
      {!!datasourcesLoading.length && (
        <LoadingPlaceholder
          text={`Loading rules from ${datasourcesLoading.length} ${pluralize('source', datasourcesLoading.length)}`}
        />
      )}
      {errors && (
        <Alert title="Errors loading rules">
          {errors.map(({ datasource, error }) => (
            <div key={datasource.name}>
              Failed to load rules from &quot;{datasource.name}&quot;: {error.message || 'Unknown error.'}
            </div>
          ))}
        </Alert>
      )}
      {namespaces?.map(({ datasource, namespace }) =>
        namespace.groups.map((group) => (
          <RulesGroup
            group={group}
            key={`${namespace.name}-${group.name}`}
            namespace={namespace.name}
            datasource={datasource}
          />
        ))
      )}
      {namespaces?.length === 0 && !datasourcesLoading.length && <p>No rules found.</p>}
    </section>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    margin-bottom: ${theme.spacing.xl};
  `,
});
