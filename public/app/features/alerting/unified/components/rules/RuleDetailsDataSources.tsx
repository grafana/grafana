import { css } from '@emotion/css';
import { type JSX, useMemo } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { type CombinedRule, type RulesSource } from 'app/types/unified-alerting';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type AlertQueryDataSources, useAlertQueryDataSources } from '../../hooks/alertQueriesStatus';
import { rulerRuleType } from '../../utils/rules';
import { isCloudRulesSource } from '../../utils/rulesSource';
import { DetailsField } from '../DetailsField';

type Props = {
  rule: CombinedRule;
  rulesSource: RulesSource;
};

type DataSourceEntry = { uid: string; name: string; icon?: string };

// Shared so non-Grafana rules hand the memo below a stable reference.
const NO_QUERIES: AlertQuery[] = [];

export function RuleDetailsDataSources(props: Props): JSX.Element | null {
  const { rulesSource, rule } = props;
  const styles = useStyles2(getStyles);
  const dataSources = useRuleDataSources(rule, rulesSource);

  if (dataSources.length === 0) {
    return null;
  }

  return (
    <DetailsField label={t('alerting.rule-details-data-sources.label-data-source', 'Data source')}>
      {dataSources.map(({ uid, name, icon }) => (
        <div key={uid}>
          {icon && (
            <>
              <img alt={`${name} datasource logo`} className={styles.dataSourceIcon} src={icon} />{' '}
            </>
          )}
          {name}
        </div>
      ))}
    </DetailsField>
  );
}

function useRuleDataSources(rule: CombinedRule, rulesSource: RulesSource): DataSourceEntry[] {
  const queries = rulerRuleType.grafana.rule(rule.rulerRule) ? rule.rulerRule.grafana_alert.data : NO_QUERIES;
  const { dataSourcesByUid } = useAlertQueryDataSources(queries);

  return useMemo(() => {
    if (isCloudRulesSource(rulesSource)) {
      return [toEntry(rulesSource)];
    }

    return uniqueQueryDataSources(queries, dataSourcesByUid);
  }, [rulesSource, queries, dataSourcesByUid]);
}

/** The resolved data sources of `queries`, once each and in query order. */
function uniqueQueryDataSources(queries: AlertQuery[], dataSourcesByUid: AlertQueryDataSources): DataSourceEntry[] {
  const unique = new Map<string, DataSourceEntry>();

  for (const query of queries) {
    const ds = dataSourcesByUid.get(query.datasourceUid);
    if (ds && !unique.has(ds.uid)) {
      unique.set(ds.uid, toEntry(ds));
    }
  }

  return Array.from(unique.values());
}

function toEntry(ds: Pick<DataSourceInstanceListItem, 'uid' | 'name' | 'meta'>): DataSourceEntry {
  return { uid: ds.uid, name: ds.name, icon: ds.meta.info.logos.small };
}

function getStyles(theme: GrafanaTheme2) {
  const size = theme.spacing(2);

  return {
    dataSourceIcon: css({
      width: size,
      height: size,
    }),
  };
}
