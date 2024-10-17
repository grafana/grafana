import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

interface AlertConditionProps {
  isCondition?: boolean;
  onSetCondition?: () => void;
}

export const ExpressionStatusIndicator = ({ isCondition, onSetCondition }: AlertConditionProps) => {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const isGrafanaRecordingRule = type === RuleFormType.grafanaRecording;
  const conditionText = isGrafanaRecordingRule ? 'Recording rule condition' : 'Alert condition';
  const makeConditionText = isGrafanaRecordingRule ? 'Set as recording rule condition' : 'Set as alert condition';

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
