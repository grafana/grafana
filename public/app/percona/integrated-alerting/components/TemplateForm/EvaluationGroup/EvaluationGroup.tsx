import { useStyles2 } from '@grafana/ui';
import { GrafanaEvaluationBehaviorStep } from 'app/features/alerting/unified/components/rule-editor/GrafanaEvaluationBehavior';

import { getStyles } from './EvaluationGroup.styles';

const EvaluationGroup = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.evaluationGroup}>
      <GrafanaEvaluationBehaviorStep enableProvisionedGroups existing={false} />
    </div>
  );
};

export default EvaluationGroup;
