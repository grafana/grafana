import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { useCleanAnnotations } from '../../utils/annotations';
import { isRecordingRulerRule } from '../../utils/rules';
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

// The limit is set to 15 in order to upkeep the good performance
// and to encourage users to go to the rule details page to see the rest of the instances
// We don't want to paginate the instances list on the alert list page
const INSTANCES_DISPLAY_LIMIT = 15;

export const RuleDetails = ({ rule }: Props) => {
  const styles = useStyles2(getStyles);
  const {
    namespace: { rulesSource },
  } = rule;

  const annotations = useCleanAnnotations(rule.annotations);

  return (
    <div>
      <RuleDetailsActionButtons rule={rule} rulesSource={rulesSource} isViewMode={false} />
      <div className={styles.wrapper}>
        <div className={styles.leftSide}>
          {<EvaluationBehaviorSummary rule={rule} />}
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
      <RuleDetailsMatchingInstances rule={rule} itemsDisplayLimit={INSTANCES_DISPLAY_LIMIT} />
    </div>
  );
};

interface EvaluationBehaviorSummaryProps {
  rule: CombinedRule;
}

const EvaluationBehaviorSummary = ({ rule }: EvaluationBehaviorSummaryProps) => {
  let forDuration: string | undefined;
  let every = rule.group.interval;

  // recording rules don't have a for duration
  if (!isRecordingRulerRule(rule.rulerRule)) {
    forDuration = rule.rulerRule?.for;
  }

  return (
    <>
      {every && (
        <DetailsField label="Evaluate" horizontal={true}>
          Every {every}
        </DetailsField>
      )}
      {forDuration && (
        <DetailsField label="For" horizontal={true}>
          {forDuration}
        </DetailsField>
      )}
    </>
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
