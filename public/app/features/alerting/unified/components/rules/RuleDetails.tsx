import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';

import { RuleDetailsActionButtons } from './RuleDetailsActionButtons';
import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';

interface Props {
  rule: CombinedRule;
}

export const RuleDetails: FC<Props> = ({ rule }) => {
  const styles = useStyles2(getStyles);
  const {
    namespace: { rulesSource },
  } = rule;

  const annotations = Object.entries(rule.annotations).filter(([_, value]) => !!value.trim());

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
          <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
          <RuleDetailsAnnotations annotations={annotations} />
        </div>
        <div className={styles.rightSide}>
          <RuleDetailsDataSources rulesSource={rulesSource} rule={rule} />
        </div>
      </div>
      <RuleDetailsMatchingInstances rule={rule} />
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
});
