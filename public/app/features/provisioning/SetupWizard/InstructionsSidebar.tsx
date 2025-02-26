import { useStyles2, Text, IconButton } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

interface InstructionsSidebarProps {
  steps: string[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const InstructionsSidebar = ({ steps, currentStep, onStepClick }: InstructionsSidebarProps) => {
  if (steps.length === 0) {
    return null;
  }

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.sidebar}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;

        const iconColor = isCompleted ? 'success' : isCurrent ? 'primary' : 'secondary';
        const iconAriaLabel = isCompleted ? 'Completed step' : isCurrent ? 'Current step' : 'Pending step';

        return (
          <div
            key={index}
            className={`${styles.stepItem} ${isCurrent ? styles.activeStep : ''}`}
            onClick={() => onStepClick(index)}
          >
            <IconButton
              name={isCompleted ? 'check-circle' : 'circle'}
              size="sm"
              variant={isPending ? 'secondary' : 'primary'}
              color={iconColor}
              aria-label={iconAriaLabel}
              onClick={(e) => {
                e.stopPropagation();
                onStepClick(index);
              }}
            />
            <Text color={isCurrent ? 'primary' : 'secondary'} weight={isCurrent ? 'medium' : 'regular'}>
              {step}
            </Text>
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sidebar: css`
      width: 260px;
      padding: ${theme.spacing(2)};
      border-right: 1px solid ${theme.colors.border.medium};
      overflow-y: auto;
    `,
    stepItem: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(2)};
      padding: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(1)};
      border-radius: ${theme.shape.borderRadius()};
      cursor: pointer;
      &:hover {
        background: ${theme.colors.action.hover};
      }
    `,
    activeStep: css`
      background: ${theme.colors.background.secondary};
    `,
  };
};
