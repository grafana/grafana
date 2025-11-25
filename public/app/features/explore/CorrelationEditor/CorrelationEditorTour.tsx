import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, Modal, Stack, Text, useStyles2 } from '@grafana/ui';

const TOUR_STORAGE_KEY = 'grafana.explore.correlationEditor.tourCompleted';

interface TourStep {
  title: string;
  content: JSX.Element;
}

const getTourSteps = (): TourStep[] => [
  {
    title: t('explore.correlation-tour.welcome-title', 'Welcome to the Correlation Editor'),
    content: (
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="explore.correlation-tour.welcome-body">
            The Correlation Editor helps you create clickable links between different data sources in Grafana. This
            makes it easy to jump from one view to another with context preserved.
          </Trans>
        </Text>
        <Text>
          <Trans i18nKey="explore.correlation-tour.welcome-example">
            For example, you can click a service name in your logs and automatically open a dashboard showing metrics
            for that service.
          </Trans>
        </Text>
      </Stack>
    ),
  },
  {
    title: t('explore.correlation-tour.step1-title', 'Step 1: Run a Query and Click a Link'),
    content: (
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="explore.correlation-tour.step1-body">
            Run a query that returns data. You can then click a link in a table cell, or use the{' '}
            <Icon name="link" size="sm" /> <strong>Correlate with [field name]</strong> button to start creating a
            correlation.
          </Trans>
        </Text>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="info-circle" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="explore.correlation-tour.step1-tip">
              Tip: Look for these correlation links in table cells or log lines
            </Trans>
          </Text>
        </Stack>
      </Stack>
    ),
  },
  {
    title: t('explore.correlation-tour.step2-title', 'Step 2: Build Your Target Query'),
    content: (
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="explore.correlation-tour.step2-body">
            After clicking a correlation link, the <strong>right pane</strong> (target) opens with a query editor. Build
            and test your query here.
          </Trans>
        </Text>
        <Text>
          <Trans i18nKey="explore.correlation-tour.step2-variables">
            Available variables are shown in the &quot;Variables&quot; section below. You can also create custom
            variables by extracting parts of fields using regular expressions or logfmt.
          </Trans>
        </Text>
      </Stack>
    ),
  },
  {
    title: t('explore.correlation-tour.step3-title', 'Step 3: Save Your Correlation'),
    content: (
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="explore.correlation-tour.step3-body">
            Once your query works correctly, click the <strong>Save</strong> button . Give your correlation a name and
            optionally add a description.
          </Trans>
        </Text>
        <Text>
          <Trans i18nKey="explore.correlation-tour.step3-result">
            After saving, this correlation link will appear for all users in the same field across all queries from your
            source data source!
          </Trans>
        </Text>
      </Stack>
    ),
  },
  {
    title: t('explore.correlation-tour.ready-title', "You're All Set!"),
    content: (
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="explore.correlation-tour.ready-body">
            You now know the basics of creating correlations. Remember, you can exit the editor at any time by clicking
            the <strong>Exit correlation editor</strong> button.
          </Trans>
        </Text>
        <Stack direction="column" gap={1}>
          <Text variant="h6">
            <Trans i18nKey="explore.correlation-tour.ready-tips-title">Quick Tips:</Trans>
          </Text>
          <Stack direction="row" gap={1}>
            <Icon name="check" />
            <Text variant="bodySmall">
              <Trans i18nKey="explore.correlation-tour.ready-tip1">
                Test your correlation query thoroughly before saving
              </Trans>
            </Text>
          </Stack>
          <Stack direction="row" gap={1}>
            <Icon name="check" />
            <Text variant="bodySmall">
              <Trans i18nKey="explore.correlation-tour.ready-tip2">
                Use clear, descriptive names so other users understand the link
              </Trans>
            </Text>
          </Stack>
          <Stack direction="row" gap={1}>
            <Icon name="check" />
            <Text variant="bodySmall">
              <Trans i18nKey="explore.correlation-tour.ready-tip3">
                Custom variables let you extract specific parts of field values
              </Trans>
            </Text>
          </Stack>
        </Stack>
      </Stack>
    ),
  },
];

interface CorrelationEditorTourProps {
  onDismiss: () => void;
}

export const CorrelationEditorTour = ({ onDismiss }: CorrelationEditorTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const styles = useStyles2(getStyles);
  const tourSteps = getTourSteps();
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep - 1);
      setIsTransitioning(false);
    }, 150);
  };

  const handleComplete = () => {
    store.set(TOUR_STORAGE_KEY, true);
    onDismiss();
  };

  const currentTourStep = tourSteps[currentStep];

  return (
    <Modal isOpen={true} title={currentTourStep.title} onDismiss={handleComplete}>
      <Stack direction="column" gap={2}>
        <div className={isTransitioning ? styles.contentTransitioning : styles.contentVisible}>
          {currentTourStep.content}
        </div>

        <div className={styles.progressContainer}>
          <Stack direction="column" gap={1.5}>
            {/* Progress indicator */}
            <Stack direction="row" gap={0.5} justifyContent="center">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={index === currentStep ? styles.progressDotActive : styles.progressDot}
                  aria-label={
                    index === currentStep
                      ? t('explore.correlation-tour.current-step', 'Current step {{step}}', {
                          step: index + 1,
                        })
                      : t('explore.correlation-tour.step-number', 'Step {{step}}', { step: index + 1 })
                  }
                />
              ))}
            </Stack>

            {/* Step counter */}
            <Text variant="bodySmall" color="secondary" textAlignment="center">
              <Trans
                i18nKey="explore.correlation-tour.step-counter"
                values={{ current: currentStep + 1, total: tourSteps.length }}
              >
                Step {{ current: currentStep + 1 }} of {{ total: tourSteps.length }}
              </Trans>
            </Text>
          </Stack>
        </div>
      </Stack>

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={handleComplete}>
          <Trans i18nKey="explore.correlation-tour.skip">Skip tour</Trans>
        </Button>
        <Stack direction="row" gap={1}>
          {!isFirstStep && (
            <Button variant="secondary" onClick={handleBack}>
              <Trans i18nKey="explore.correlation-tour.back">Back</Trans>
            </Button>
          )}
          <Button variant="primary" onClick={handleNext}>
            {isLastStep ? (
              <Trans i18nKey="explore.correlation-tour.got-it">Got it!</Trans>
            ) : (
              <Trans i18nKey="explore.correlation-tour.next">Next</Trans>
            )}
          </Button>
        </Stack>
      </Modal.ButtonRow>
    </Modal>
  );
};

/**
 * Hook to check if the tour should be shown for first-time users
 */
export const useCorrelationEditorTour = () => {
  const [shouldShowTour, setShouldShowTour] = useState(false);

  useEffect(() => {
    const hasCompletedTour = store.getBool(TOUR_STORAGE_KEY, false);
    if (!hasCompletedTour) {
      // Small delay to let the UI settle before showing the tour
      const timer = setTimeout(() => {
        setShouldShowTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const dismissTour = () => {
    setShouldShowTour(false);
  };

  return { shouldShowTour, dismissTour };
};

const getStyles = (theme: GrafanaTheme2) => ({
  contentVisible: css({
    opacity: 1,
    [theme.transitions.handleMotion('no-preference')]: {
      transform: 'translateY(0)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    },
  }),
  contentTransitioning: css({
    opacity: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      transform: 'translateY(-8px)',
      transition: 'opacity 0.15s ease, transform 0.15s ease',
    },
  }),
  progressContainer: css({
    marginTop: theme.spacing(2),
  }),
  progressDot: css({
    width: '8px',
    height: '8px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.border.medium,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.2s ease',
    },
  }),
  progressDotActive: css({
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.primary.main,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.2s ease',
    },
  }),
});
