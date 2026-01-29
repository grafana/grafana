import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { useStepperState } from './StepperState';
import { getWizardSteps } from './constants';
import { StepKey, StepState } from './types';

/**
 * Stepper component - sidebar navigation for the wizard
 * - Completed without errors: green check icon
 * - Completed with errors/warnings: yellow warning icon
 * - Skipped: minus icon
 * - Pending: number
 */
export const Stepper = () => {
  const styles = useStyles2(getStyles);
  const { activeStep, setActiveStep, setVisitedStep, visitedSteps, isStepCompleted, isStepSkipped, hasStepErrors } =
    useStepperState();

  const steps = getWizardSteps();
  const lastStep = steps[steps.length - 1];

  const handleStepClick = (stepId: StepKey) => {
    // Mark current step as visited before navigating
    setVisitedStep(activeStep);
    setActiveStep(stepId);
  };

  const canNavigateToStep = (stepId: StepKey): boolean => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const activeIndex = steps.findIndex((s) => s.id === activeStep);

    // Can always go back to previous steps
    if (stepIndex <= activeIndex) {
      return true;
    }

    // Can only go forward if all previous steps are completed or skipped
    for (let i = 0; i < stepIndex; i++) {
      const step = steps[i];
      if (!isStepCompleted(step.id) && !isStepSkipped(step.id)) {
        return false;
      }
    }
    return true;
  };

  return (
    <ol className={styles.container}>
      {steps.map((step, index) => {
        const isLast = step.id === lastStep.id;
        const isActive = step.id === activeStep;
        const isVisited = visitedSteps[step.id] === StepState.Visited;
        const isCompleted = isStepCompleted(step.id);
        const isSkipped = isStepSkipped(step.id);
        const hasErrors = hasStepErrors(step.id);
        const canNavigate = canNavigateToStep(step.id);

        // Determine visual state
        // - Warning: visited, not current, not last, has validation errors
        // - Success: visited, not current, not last, completed without errors
        // - Skipped: skipped and not active
        const showWarning = isVisited && !isActive && !isLast && hasErrors;
        const showSuccess = isVisited && !isActive && !isLast && isCompleted && !hasErrors && !isSkipped;
        const showSkipped = isSkipped && !isActive;
        const showNumber = !showWarning && !showSuccess && !showSkipped;

        const itemStyles = cx(styles.item, {
          [styles.active]: isActive,
        });

        return (
          <li key={step.id} className={itemStyles}>
            <button
              type="button"
              className={cx(styles.stepButton, {
                [styles.stepButtonDisabled]: !canNavigate,
              })}
              onClick={() => handleStepClick(step.id)}
              disabled={!canNavigate}
            >
              <span className={styles.indicator}>
                {showWarning && <Icon name="exclamation-triangle" className={styles.warningIcon} />}
                {showSuccess && <Icon name="check" className={styles.successIcon} />}
                {showSkipped && <Icon name="minus" className={styles.skippedIcon} />}
                {showNumber && <span>{index + 1}</span>}
              </span>
              <span className={styles.stepName}>{step.name}</span>
            </button>
            {!isLast && <div className={styles.divider} />}
          </li>
        );
      })}
    </ol>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    paddingRight: theme.spacing(4),
    borderRight: `1px solid ${theme.colors.border.weak}`,
    minWidth: '220px',
  }),
  item: css({
    position: 'relative',
    color: theme.colors.text.secondary,
  }),
  active: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.maxContrast,
  }),
  stepButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
    fontWeight: 'inherit',
    fontSize: theme.typography.body.fontSize,
    width: '100%',

    '&:hover:not(:disabled)': {
      color: theme.colors.text.link,
    },
  }),
  stepButtonDisabled: css({
    cursor: 'not-allowed',
    opacity: 0.5,

    '&:hover': {
      color: 'inherit',
    },
  }),
  indicator: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(2),
    flexShrink: 0,
  }),
  stepName: css({
    // Inherits styles from parent
  }),
  warningIcon: css({
    color: theme.colors.warning.text,
  }),
  successIcon: css({
    color: theme.colors.success.text,
  }),
  skippedIcon: css({
    color: theme.colors.text.secondary,
  }),
  divider: css({
    height: theme.spacing(2),
    borderLeft: `1px dotted ${theme.colors.text.secondary}`,
    marginLeft: theme.spacing(1),
  }),
});
