import { useStyles2, Text, IconButton, Stack, Card } from '@grafana/ui';
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
        {steps.map((step, index) => (
          <StepItem
            key={index}
            step={step}
            index={index}
            currentStep={currentStep}
            onStepClick={onStepClick}
            styles={styles}
          />
        ))}
      </Stack>
    </div>
  );
};

interface StepItemProps {
  step: string;
  index: number;
  currentStep: number;
  onStepClick: (index: number) => void;
  styles: ReturnType<typeof getStyles>;
}

const StepItem = ({ step, index, currentStep, onStepClick, styles }: StepItemProps) => {
  const isCompleted = index < currentStep;
  const isCurrent = index === currentStep;
  const isPending = index > currentStep;

  const getStepStatus = () => {
    if (isCompleted) return { icon: 'check-circle' as const, color: 'success', label: 'Completed step' };
    if (isCurrent) return { icon: 'circle' as const, color: 'primary', label: 'Current step' };
    return { icon: 'circle' as const, color: 'secondary', label: 'Pending step' };
  };

  const { icon, color, label } = getStepStatus();

  const handleClick = () => onStepClick(index);
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStepClick(index);
  };

  return (
    <Card
      className={`${styles.stepItem} ${isCurrent ? styles.activeStep : ''} ${styles.plainCard}`}
      onClick={handleClick}
    >
      <Stack direction="row" alignItems="center" gap={2}>
        <IconButton
          name={icon}
          size="sm"
          variant={isPending ? 'secondary' : 'primary'}
          color={color}
          aria-label={label}
          onClick={handleIconClick}
        />
        <Text color={isCurrent ? 'primary' : 'secondary'} weight={isCurrent ? 'medium' : 'regular'}>
          {step}
        </Text>
      </Stack>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sidebar: css`
    width: 260px;
    padding: ${theme.spacing(1)};
    overflow-y: auto;
  `,
  stepItem: css`
    padding: ${theme.spacing(1)};
    cursor: pointer;
    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  activeStep: css`
    color: ${theme.colors.primary.text};
  `,
  plainCard: css`
    background: transparent;
    border: none;
    box-shadow: none;
  `,
});
