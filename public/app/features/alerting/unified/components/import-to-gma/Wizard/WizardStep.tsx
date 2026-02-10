import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FieldSet, Stack, useStyles2 } from '@grafana/ui';

import { CancelButton } from './CancelButton';
import { NextButton } from './NextButton';
import { PreviousButton } from './PreviousButton';
import { useStepperState } from './StepperState';
import { StepKey } from './types';

interface WizardStepProps {
  /** Step identifier */
  stepId: StepKey;
  /** Step title displayed in the header */
  label: string;
  /** Optional subtitle/description */
  subHeader?: ReactNode;
  /** Step content */
  children: ReactNode;
  /** Whether this step can be skipped */
  canSkip?: boolean;
  /** Custom label for skip button */
  skipLabel?: string;
  /** Handler called when Next is clicked - should return true to proceed */
  onNext?: () => boolean | Promise<boolean>;
  /** Handler called when Skip is clicked */
  onSkip?: () => void;
  /** Handler called when Previous is clicked */
  onBack?: () => void;
  /** Disable the next button */
  disableNext?: boolean;
}

/**
 * WizardStep - wrapper component for each step in the wizard
 *
 * Provides consistent layout with:
 * - Step title (FieldSet label)
 * - Optional description
 * - Step content
 * - Navigation buttons (Previous, Next/Skip, Cancel)
 */
export const WizardStep = ({
  stepId,
  label,
  subHeader,
  children,
  canSkip = false,
  skipLabel,
  onNext,
  onSkip,
  onBack,
  disableNext = false,
}: WizardStepProps) => {
  const styles = useStyles2(getStyles);
  const { setVisitedStep, setStepCompleted, setStepSkipped } = useStepperState();

  const handleNext = async () => {
    // If onNext is provided, call it and only proceed if it returns true
    if (onNext) {
      const shouldProceed = await onNext();
      if (!shouldProceed) {
        return false;
      }
    }

    setVisitedStep(stepId);
    setStepCompleted(stepId, true);
    setStepSkipped(stepId, false);
    return true;
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    setVisitedStep(stepId);
    setStepCompleted(stepId, false);
    setStepSkipped(stepId, true);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  return (
    <FieldSet label={label} className={styles.fieldSet}>
      {subHeader && <div className={styles.subHeader}>{subHeader}</div>}
      <div className={styles.content}>{children}</div>
      <div className={styles.actions}>
        <Stack direction="row" gap={1}>
          <PreviousButton onBack={handleBack} />
          <NextButton
            onNext={handleNext}
            canSkip={canSkip}
            skipLabel={skipLabel}
            onSkip={handleSkip}
            disabled={disableNext}
          />
        </Stack>
        <CancelButton />
      </div>
    </FieldSet>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldSet: css({
    '& legend': {
      marginBottom: theme.spacing(0.5),
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  subHeader: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(3),
    maxWidth: 800,
  }),
  content: css({
    marginBottom: theme.spacing(4),
    maxWidth: 800,
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 800,
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
