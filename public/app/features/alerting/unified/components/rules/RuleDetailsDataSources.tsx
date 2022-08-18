import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { isCloudRulesSource } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';

type Props = {
  rule: CombinedRule;
  rulesSource: RulesSource;
};

export function RuleDetailsDataSources(props: Props): JSX.Element | null {
  const { rulesSource, rule } = props;
  const styles = useStyles2(getStyles);

  const dataSources: Array<{ name: string; icon?: string }> = useMemo(() => {
    if (isCloudRulesSource(rulesSource)) {
      return [{ name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
    }

    if (isGrafanaRulerRule(rule.rulerRule)) {
      const { data } = rule.rulerRule.grafana_alert;
      const unique = data.reduce((dataSources, query) => {
        const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);

        if (!ds || ds.uid === ExpressionDatasourceUID) {
          return dataSources;
        }

        dataSources[ds.name] = { name: ds.name, icon: ds.meta.info.logos.small };
        return dataSources;
      }, {} as Record<string, { name: string; icon?: string }>);

      return Object.values(unique);
    }

    return [];
  }, [rule, rulesSource]);

  if (dataSources.length === 0) {
    return null;
  }

  return (
    <DetailsField label="Data source">
      {dataSources.map(({ name, icon }, index) => (
        <div key={name}>
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
    dataSourceIcon: css`
      width: ${size};
      height: ${size};
    `,
  };
}
