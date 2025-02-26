import { useState } from 'react';
import { Modal, Button, useStyles2, Stack, Text } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Feature } from './types';
import { SetupStep } from './SetupStep';
import { Sidebar } from './Sidebar';

export interface Props {
  feature: Feature;
  isOpen: boolean;
  onDismiss: () => void;
}

export const SetupModal = ({ feature, isOpen, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  // Initialize to the first unfulfilled step or 0
  const initialStepIndex = feature.setupSteps.findIndex((step) => !step.fulfilled);
  const [currentStep, setCurrentStep] = useState(initialStepIndex === -1 ? 0 : initialStepIndex);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === feature.setupSteps.length - 1;
  const stepTitles = feature.setupSteps.map((step) => step.title);

  const handleNext = () => !isLastStep && setCurrentStep(currentStep + 1);
  const handlePrevious = () => !isFirstStep && setCurrentStep(currentStep - 1);

  return (
    <Modal isOpen={isOpen} title={`Setup ${feature.title}`} onDismiss={onDismiss} className={styles.modal}>
      <div style={{ marginTop: '-16px', marginBottom: '20px' }}>
        <Text variant="body" color="secondary">
          {feature.description}
        </Text>
      </div>
      <Stack direction="row" height="100%">
        <Sidebar steps={stepTitles} currentStep={currentStep} onStepClick={setCurrentStep} />

        <div className={styles.contentWrapper}>
          <SetupStep step={feature.setupSteps[currentStep]} />
        </div>
      </Stack>

      <div className={styles.footer}>
        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Button variant="secondary" onClick={handlePrevious} disabled={isFirstStep}>
            Previous
          </Button>

          {isLastStep ? (
            <Button variant="primary" onClick={onDismiss} icon="check-circle">
              Done
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNext}>
              Next
            </Button>
          )}
        </Stack>
      </div>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 1100px;
    max-width: 95%;
  `,
  description: css`
    margin-bottom: ${theme.spacing(3)};
    padding: 0 ${theme.spacing(1)};
  `,
  contentWrapper: css`
    flex: 1;
    overflow-y: auto;
    min-width: 0;
    padding: ${theme.spacing(2)};
    border-left: 1px solid ${theme.colors.border.weak};
  `,
  footer: css`
    padding: ${theme.spacing(2)};
    border-top: 1px solid ${theme.colors.border.weak};
    margin-top: ${theme.spacing(2)};
  `,
});
