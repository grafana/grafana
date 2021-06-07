import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';
import { RuleDetailsActionButtons } from './RuleDetailsActionButtons';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleDetails: FC<Props> = ({ rule, rulesSource }) => {
  const styles = useStyles(getStyles);
  const { promRule } = rule;

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
          <RuleDetailsExpression rulesSource={rulesSource} rule={rule} />
          <RuleDetailsAnnotations rule={rule} />
        </div>
        <div className={styles.rightSide}>
          <RuleDetailsDataSources rulesSource={rulesSource} rule={rule} />
        </div>
      </div>
      <RuleDetailsMatchingInstances promRule={promRule} />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;
    flex-direction: row;
  `,
  leftSide: css`
    flex: 1;
  `,
  rightSide: css`
    padding-left: 90px;
    width: 300px;
  `,
});
