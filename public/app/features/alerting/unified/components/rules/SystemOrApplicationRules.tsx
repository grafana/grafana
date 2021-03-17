import { css } from 'emotion';
import { DataSourceInstanceSettings, GrafanaTheme } from '@grafana/data';
import { Icon, InfoBox, LoadingPlaceholder, useStyles } from '@grafana/ui';
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
  useEffect(() => getRulesDatasources().forEach((ds) => dispatch(fetchRulesAction(ds.name))), []);

  const namespaces = useMemo(
    (): Array<{ namespace: RuleNamespace; datasource: DataSourceInstanceSettings }> =>
      rulesDatasources
        .map((datasource) => rules[datasource.name]?.result?.map((namespace) => ({ namespace, datasource })) || [])
        .flat()
        .sort((a, b) => b.namespace.name.localeCompare(a.namespace.name)),
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
      <div className={styles.sectionHeader}>
        <h5>System or application</h5>
        {datasourcesLoading.length ? (
          <LoadingPlaceholder
            className={styles.loader}
            text={`Loading rules from ${datasourcesLoading.length} ${pluralize('source', datasourcesLoading.length)}`}
          />
        ) : (
          <div />
        )}
      </div>
      {errors && (
        <InfoBox
          title={
            <h4>
              <Icon className={styles.iconError} name="exclamation-triangle" size="xl" />
              Errors loading rules
            </h4>
          }
          severity="error"
        >
          {errors.map(({ datasource, error }) => (
            <div key={datasource.name}>
              Failed to load rules from <a href={`datasources/edit/${datasource.id}`}>{datasource.name}</a>:{' '}
              {error.message || 'Unknown error.'}
            </div>
          ))}
        </InfoBox>
      )}
      {namespaces?.map(({ datasource, namespace }) =>
        namespace.groups.map((group) => (
          <RulesGroup
            group={group}
            key={`${datasource.name}-${namespace.name}-${group.name}`}
            namespace={namespace.name}
            datasource={datasource}
          />
        ))
      )}
      {namespaces?.length === 0 && !datasourcesLoading.length && !!rulesDatasources.length && <p>No rules found.</p>}
      {!rulesDatasources.length && <p>There are no Prometheus or Loki datasources configured.</p>}
    </section>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  loader: css`
    margin-bottom: 0;
  `,
  sectionHeader: css`
    display: flex;
    justify-content: space-between;
  `,
  iconError: css`
    color: ${theme.palette.red};
    margin-right: ${theme.spacing.md};
  `,
  wrapper: css`
    margin-bottom: ${theme.spacing.xl};
  `,
});
