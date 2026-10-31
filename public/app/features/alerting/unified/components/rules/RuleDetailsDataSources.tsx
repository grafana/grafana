import { css } from '@emotion/css';
import { type JSX, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { type CombinedRule, type RulesSource } from 'app/types/unified-alerting';

import { useAlertQueryDataSources } from '../../hooks/alertQueriesStatus';
import { isCloudRulesSource } from '../../utils/datasource';
import { rulerRuleType } from '../../utils/rules';
import { DetailsField } from '../DetailsField';

type Props = {
  rule: CombinedRule;
  rulesSource: RulesSource;
};

export function RuleDetailsDataSources(props: Props): JSX.Element | null {
  const { rulesSource, rule } = props;
  const styles = useStyles2(getStyles);

  const queries = rulerRuleType.grafana.rule(rule.rulerRule) ? rule.rulerRule.grafana_alert.data : [];
  const { dataSourcesByUid } = useAlertQueryDataSources(queries);

  const dataSources: Array<{ uid: string; name: string; icon?: string }> = useMemo(() => {
    if (isCloudRulesSource(rulesSource)) {
      return [{ uid: rulesSource.uid, name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
    }

    if (rulerRuleType.grafana.rule(rule.rulerRule)) {
      const { data } = rule.rulerRule.grafana_alert;
      const unique = new Map<string, { uid: string; name: string; icon?: string }>();

      for (const query of data) {
        const ds = dataSourcesByUid.get(query.datasourceUid);
        if (ds && !unique.has(ds.uid)) {
          unique.set(ds.uid, { uid: ds.uid, name: ds.name, icon: ds.meta.info.logos.small });
        }
      }

      return Array.from(unique.values());
    }

    return [];
  }, [rule, rulesSource, dataSourcesByUid]);

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

function getStyles(theme: GrafanaTheme2) {
  const size = theme.spacing(2);

  return {
    dataSourceIcon: css({
      width: size,
      height: size,
    }),
  };
}
