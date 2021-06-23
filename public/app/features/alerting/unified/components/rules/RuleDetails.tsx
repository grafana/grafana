import { CombinedRule } from 'app/types/unified-alerting';
import React, { FC, useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { isAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { isCloudRulesSource } from '../../utils/datasource';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { AlertLabels } from '../AlertLabels';
import { AlertInstancesTable } from './AlertInstancesTable';
import { DetailsField } from '../DetailsField';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { Expression } from '../Expression';
import { RuleDetailsActionButtons } from './RuleDetailsActionButtons';

interface Props {
  rule: CombinedRule;
}

export const RuleDetails: FC<Props> = ({ rule }) => {
  const styles = useStyles2(getStyles);

  const {
    promRule,
    namespace: { rulesSource },
  } = rule;

  const annotations = Object.entries(rule.annotations).filter(([_, value]) => !!value.trim());

  const dataSources: Array<{ name: string; icon?: string }> = useMemo(() => {
    if (isCloudRulesSource(rulesSource)) {
      return [{ name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
    }

    if (isGrafanaRulerRule(rule.rulerRule)) {
      const { data } = rule.rulerRule.grafana_alert;

      return data.reduce((dataSources, query) => {
        const ds = getDatasourceSrv().getInstanceSettings(query.datasourceUid);

        if (!ds || ds.uid === ExpressionDatasourceUID) {
          return dataSources;
        }

        dataSources.push({ name: ds.name, icon: ds.meta.info.logos.small });
        return dataSources;
      }, [] as Array<{ name: string; icon?: string }>);
    }

    return [];
  }, [rule, rulesSource]);

  return (
    <div>
      <RuleDetailsActionButtons rule={rule} rulesSource={rulesSource} />
      <div className={styles.wrapper}>
        <div className={styles.leftSide}>
          {!!rule.labels && !!Object.keys(rule.labels).length && (
            <DetailsField label="Labels" horizontal={true}>
              <AlertLabels labels={rule.labels} />
            </DetailsField>
          )}
          {isCloudRulesSource(rulesSource) && (
            <DetailsField
              label="Expression"
              className={cx({ [styles.exprRow]: !!annotations.length })}
              horizontal={true}
            >
              <Expression expression={rule.query} rulesSource={rulesSource} />
            </DetailsField>
          )}
          {annotations.map(([key, value]) => (
            <AnnotationDetailsField key={key} annotationKey={key} value={value} />
          ))}
        </div>
        <div className={styles.rightSide}>
          {!!dataSources.length && (
            <DetailsField label="Data source">
              {dataSources.map(({ name, icon }) => (
                <div key={name}>
                  {icon && (
                    <>
                      <img className={styles.dataSourceIcon} src={icon} />{' '}
                    </>
                  )}
                  {name}
                </div>
              ))}
            </DetailsField>
          )}
        </div>
      </div>
      {promRule && isAlertingRule(promRule) && !!promRule.alerts?.length && (
        <DetailsField label="Matching instances" horizontal={true}>
          <AlertInstancesTable instances={promRule.alerts} />
        </DetailsField>
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: row;
    ${theme.breakpoints.down('md')} {
      flex-direction: column;
    }
  `,
  leftSide: css`
    flex: 1;
  `,
  rightSide: css`
    ${theme.breakpoints.up('md')} {
      padding-left: 90px;
      width: 300px;
    }
  `,
  exprRow: css`
    margin-bottom: 46px;
  `,
  dataSourceIcon: css`
    width: ${theme.spacing(2)};
    height: ${theme.spacing(2)};
  `,
});
