import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Modal, Button, useStyles2, Stack, Text } from '@grafana/ui';

import { SetupStep } from './SetupStep';
import { Sidebar } from './Sidebar';
import { Step } from './types';

export interface Props {
  title: string;
  description: string;
  steps: Step[];

  isOpen: boolean;
  onDismiss: () => void;
}

export const SetupModal = ({ title, description, steps, isOpen, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  const [currentStep, setCurrentStep] = useState(0);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const stepTitles = steps.map((step) => step.title);

  const handleNext = () => !isLastStep && setCurrentStep(currentStep + 1);
  const handlePrevious = () => !isFirstStep && setCurrentStep(currentStep - 1);

  return (
    <Modal isOpen={isOpen} title={title} onDismiss={onDismiss} className={styles.modal}>
      <Stack direction={'column'} gap={4}>
        <Text variant="body" color="secondary">
          {description}
        </Text>
        <Stack direction="row" height="100%">
          <Sidebar steps={stepTitles} currentStep={currentStep} onStepClick={setCurrentStep} />

          <div className={styles.contentWrapper}>
            <SetupStep step={steps[currentStep]} />
          </div>
        </Stack>
      </Stack>

      <Modal.ButtonRow>
        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Button variant="secondary" onClick={handlePrevious} disabled={isFirstStep}>
            <Trans i18nKey="provisioning.setup-modal.previous">Previous</Trans>
          </Button>

          {isLastStep ? (
            <Button variant="primary" onClick={onDismiss} icon="check-circle">
              <Trans i18nKey="provisioning.setup-modal.done">Done</Trans>
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNext}>
              <Trans i18nKey="provisioning.setup-modal.next">Next</Trans>
            </Button>
          )}
        </Stack>
      </Modal.ButtonRow>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '1100px',
    maxWidth: '95%',
  }),
  description: css({
    marginBottom: theme.spacing(3),
    padding: theme.spacing(0, 1),
  }),
  contentWrapper: css({
    flex: 1,
    overflowY: 'auto',
    minWidth: 0,
    padding: theme.spacing(2),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  footer: css({
    padding: theme.spacing(2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(2),
  }),
});
