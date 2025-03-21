import { useFormContext } from 'react-hook-form';

import { useStyles2 } from '@grafana/ui';
import { GrafanaEvaluationBehaviorStep } from 'app/features/alerting/unified/components/rule-editor/GrafanaEvaluationBehavior';
import { TemplatedAlertFormValues } from 'app/percona/integrated-alerting/types';

import { getStyles } from './EvaluationGroup.styles';

const EvaluationGroup = () => {
  const { setValue, watch } = useFormContext<TemplatedAlertFormValues>();
  const evaluateEvery = watch('evaluateEvery');
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.evaluationGroup}>
      <GrafanaEvaluationBehaviorStep
        enableProvisionedGroups
        evaluateEvery={evaluateEvery}
        setEvaluateEvery={(value) => setValue('evaluateEvery', value)}
        existing={false}
      />
    </div>
  );
};

export default EvaluationGroup;
