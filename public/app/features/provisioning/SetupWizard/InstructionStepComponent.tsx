import { useStyles2 } from '@grafana/ui';
import { InstructionStep } from './types';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

// Simplified Props - removed totalSteps, copied, and onCopy
export interface Props {
  step: InstructionStep;
}

export const InstructionStepComponent = ({ step }: Props) => {
  const styles = useStyles2(getComponentStyles);

  return (
    <>
      <div className={styles.stepIndicator}>
        <span className={styles.stepTitle}>{step?.title}</span>
      </div>

      <div className={styles.content}>
        {step.description && <p className={styles.description}>{step.description}</p>}
        {step.code && <CodeBlockWithCopy code={step.code} copyCode={step.copyCode} />}
      </div>
    </>
  );
};

// Simplified component styles
const getComponentStyles = (theme: GrafanaTheme2) => {
  return {
    stepIndicator: css`
      display: flex;
      align-items: center;
      padding: 16px 24px 12px;
      border-bottom: 1px solid rgba(204, 204, 220, 0.15);
    `,
    stepTitle: css`
      font-size: 18px;
      font-weight: 500;
      color: ${theme.colors.text.primary};
    `,
    content: css`
      padding: 16px 24px;
    `,
    description: css`
      margin-bottom: 16px;
    `,
  };
};
