import { useStyles2, Stack, Box } from '@grafana/ui';

import { SidebarItem, getStyles as getStepItemStyles } from './SidebarItem';

interface Props {
  steps: string[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export const Sidebar = ({ steps, currentStep, onStepClick }: Props) => {
  if (steps.length === 0 || steps.length === 1) {
    return null;
  }

  const stepItemStyles = useStyles2(getStepItemStyles);

  return (
    <Box width={'260px'} padding={1}>
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
    </Box>
  );
};
