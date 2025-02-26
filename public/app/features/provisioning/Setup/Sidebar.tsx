import { useStyles2, Stack } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { SidebarItem, getStyles as getStepItemStyles } from './SidebarItem';

interface Props {
  steps: string[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const Sidebar = ({ steps, currentStep, onStepClick }: Props) => {
  if (steps.length === 0) {
    return null;
  }

  const styles = useStyles2(getStyles);
  const stepItemStyles = useStyles2(getStepItemStyles);

  return (
    <div className={styles.sidebar}>
      <Stack direction="column" gap={1}>
        {steps.map((step, index) => (
          <SidebarItem
            key={index}
            step={step}
            index={index}
            currentStep={currentStep}
            onStepClick={onStepClick}
            styles={stepItemStyles}
          />
        ))}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sidebar: css`
    width: 260px;
    padding: ${theme.spacing(1)};
    overflow-y: auto;
  `,
});
