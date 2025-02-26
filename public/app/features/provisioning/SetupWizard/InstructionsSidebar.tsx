import { useStyles2, Text, Stack, IconButton } from '@grafana/ui';
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
      <Stack direction="column" gap={1}>
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
              <Stack direction="row" alignItems="center" gap={1}>
                <div className={styles.iconWrapper}>
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
                  {index < steps.length - 1 && (
                    <div className={`${styles.connector} ${isCompleted ? styles.completedConnector : ''}`} />
                  )}
                </div>

                <Text color={isCurrent ? 'primary' : 'secondary'} weight={isCurrent ? 'medium' : 'regular'}>
                  {step}
                </Text>
              </Stack>
            </div>
          );
        })}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sidebar: css`
      width: 260px;
      padding: ${theme.spacing(2)} 0;
      border-right: 1px solid ${theme.colors.border.medium};
      overflow-y: auto;
    `,
    stepItem: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      cursor: pointer;
      &:hover {
        background: ${theme.colors.action.hover};
      }
    `,
    activeStep: css`
      background: ${theme.colors.background.secondary};
    `,
    iconWrapper: css`
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
    `,
    connector: css`
      position: absolute;
      top: 24px;
      bottom: -24px;
      left: 50%;
      width: 2px;
      background: ${theme.colors.border.medium};
      transform: translateX(-50%);
    `,
    completedConnector: css`
      background: ${theme.colors.primary.main};
    `,
  };
};
