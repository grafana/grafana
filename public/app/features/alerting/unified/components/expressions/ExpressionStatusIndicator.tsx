import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { isGrafanaRecordingRuleByType } from '../../utils/rules';

interface AlertConditionProps {
  isCondition?: boolean;
  onSetCondition?: () => void;
  refId?: string;
}

export const ExpressionStatusIndicator = ({ isCondition, onSetCondition, refId }: AlertConditionProps) => {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const isGrafanaRecordingRule = type ? isGrafanaRecordingRuleByType(type) : false;
  const conditionText = isGrafanaRecordingRule ? 'Recording rule output' : 'Alert condition';

  const setAsConditionText = refId ? `Set "${refId}" as alert condition` : 'Set as alert condition';
  const makeConditionText = isGrafanaRecordingRule ? 'Set as recording rule output' : setAsConditionText;

  if (isCondition) {
    return <Badge key="condition" color="green" icon="check" text={conditionText} />;
  } else {
    return (
      <button
        key="make-condition"
        type="button"
        className={styles.actionLink}
        onClick={() => onSetCondition && onSetCondition()}
      >
        {makeConditionText}
      </button>
    );
  }
};

const getStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    actionLink: css(clearButton, {
      color: theme.colors.text.link,
      cursor: 'pointer',

      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
