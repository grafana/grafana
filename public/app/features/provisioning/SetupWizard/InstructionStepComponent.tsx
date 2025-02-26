import { useStyles2, Icon } from '@grafana/ui';
import { InstructionStep } from './types';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

// Moved from types.ts and renamed to Props
export interface Props {
  step: InstructionStep;
  totalSteps: number;
  copied: boolean;
  onCopy: () => void;
}

export const InstructionStepComponent = ({ step, totalSteps, copied, onCopy }: Props) => {
  const styles = useStyles2(getComponentStyles);

  return (
    <div className={step.fulfilled ? styles.fulfilledStepContent : styles.stepContent}>
      <div className={styles.stepIndicator}>
        {step.fulfilled ? (
          <Icon name="check-circle" className={styles.fulfilledIcon} />
        ) : (
          <span className={styles.stepIndicatorActive}>{totalSteps}</span>
        )}
        <h3 className={step.fulfilled ? styles.stepTitleCompleted : styles.stepTitleActive}>
          {step.title}
          {step.fulfilled && <span className={styles.fulfilledBadge}>Completed</span>}
        </h3>
      </div>
      {step.description && <p>{step.description}</p>}
      {step.code && <CodeBlockWithCopy code={step.code} copyCode={step.copyCode} />}
    </div>
  );
};

// Component-specific styles
const getComponentStyles = (theme: GrafanaTheme2) => {
  return {
    stepContent: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    fulfilledStepContent: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    stepIndicator: css`
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing(2)};
    `,
    stepIndicatorActive: css`
      color: ${theme.colors.primary.text};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    fulfilledIcon: css`
      color: ${theme.colors.success.main};
      margin-right: ${theme.spacing(1)};
    `,
    stepTitleActive: css`
      color: ${theme.colors.primary.text};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      margin-bottom: ${theme.spacing(1)};
    `,
    stepTitleCompleted: css`
      color: ${theme.colors.success.text};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      margin-bottom: ${theme.spacing(1)};
    `,
    fulfilledBadge: css`
      background-color: ${theme.colors.success.main};
      color: ${theme.colors.success.contrastText};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      border-radius: ${theme.shape.borderRadius(0.5)};
      margin-left: ${theme.spacing(1)};
      display: inline-block;
    `,
  };
};
