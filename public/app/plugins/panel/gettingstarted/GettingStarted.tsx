// Libraries
import { css, cx } from '@emotion/css';
import { memo, useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useUserStorage } from '@grafana/runtime/internal';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { Step } from './components/Step';
import { getSteps } from './steps';
import { type SetupStep } from './types';

const STORAGE_KEY = 'gettingStartedPanelDismissed';

export const GettingStarted = memo(function GettingStarted({ id }: PanelProps) {
  const storage = useUserStorage('grafana-help-flags');
  const [checksDone, setChecksDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<SetupStep[]>(getSteps());
  const styles = useStyles2(getStyles);

  useEffect(() => {
    Promise.all([
      storage.getItem(STORAGE_KEY),
      ...steps.map(async (step: SetupStep) => {
        const checkedCards = await Promise.all(
          step.cards.map((card) => card.check().then((passed) => ({ ...card, done: passed })))
        );
        return { ...step, done: checkedCards.every((c) => c.done), cards: checkedCards };
      }),
    ]).then(([dismissed, ...checkedSteps]) => {
      if (dismissed === 'true') {
        const dashboard = getDashboardSrv().getCurrent();
        const panel = dashboard?.getPanelById(id);
        dashboard?.removePanel(panel!);
        return;
      }
      setSteps(checkedSteps);
      setCurrentStep(!checkedSteps[0].done ? 0 : 1);
      setChecksDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onForwardClick = () => {
    reportInteraction('grafana_getting_started_button_to_advanced_tutorials');
    setCurrentStep((prev) => prev + 1);
  };

  const onPreviousClick = () => {
    reportInteraction('grafana_getting_started_button_to_basic_tutorials');
    setCurrentStep((prev) => prev - 1);
  };

  const dismiss = async () => {
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(id);
    reportInteraction('grafana_getting_started_remove_panel');
    dashboard?.removePanel(panel!);
    await storage.setItem(STORAGE_KEY, 'true');
  };

  const step = steps[currentStep];

  return (
    <div className={styles.container}>
      {!checksDone ? (
        <div className={styles.loading}>
          <div className={styles.loadingText}>
            <Trans i18nKey="gettingstarted.getting-started.checking-completed-setup-steps">
              Checking completed setup steps
            </Trans>
          </div>
          <Spinner size="xl" inline />
        </div>
      ) : (
        <>
          <Button size="sm" fill="text" className={styles.dismiss} onClick={dismiss}>
            <Trans i18nKey="gettingstarted.getting-started.remove-this-panel">Remove this panel</Trans>
          </Button>
          {currentStep === steps.length - 1 && (
            <Button
              className={cx(styles.backForwardButtons, styles.previous)}
              onClick={onPreviousClick}
              aria-label={t('gettingstarted.getting-started.aria-label-to-basic-tutorials', 'To basic tutorials')}
              icon="angle-left"
              variant="secondary"
            />
          )}
          <div className={styles.content}>
            <Step step={step} />
          </div>
          {currentStep < steps.length - 1 && (
            <Button
              className={cx(styles.backForwardButtons, styles.forward)}
              onClick={onForwardClick}
              aria-label={t('gettingstarted.getting-started.aria-label-to-advanced-tutorials', 'To advanced tutorials')}
              icon="angle-right"
              variant="secondary"
            />
          )}
        </>
      )}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundSize: 'cover',
      padding: `${theme.spacing(4)} ${theme.spacing(2)} 0`,
    }),
    content: css({
      label: 'content',
      display: 'flex',
      justifyContent: 'center',

      [theme.breakpoints.down('xxl')]: {
        marginLeft: theme.spacing(3),
        justifyContent: 'flex-start',
      },
    }),
    header: css({
      label: 'header',
      marginBottom: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',

      [theme.breakpoints.down('lg')]: {
        flexDirection: 'row',
      },
    }),
    headerLogo: css({
      height: '58px',
      paddingRight: theme.spacing(2),
      display: 'none',

      [theme.breakpoints.up('md')]: {
        display: 'block',
      },
    }),
    heading: css({
      label: 'heading',
      marginRight: theme.spacing(3),
      marginBottom: theme.spacing(3),
      flexGrow: 1,
      display: 'flex',

      [theme.breakpoints.up('md')]: {
        marginBottom: 0,
      },
    }),
    backForwardButtons: css({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    }),
    previous: css({
      left: '10px',
      [theme.breakpoints.down('md')]: {
        left: 0,
      },
    }),
    forward: css({
      right: '10px',
      [theme.breakpoints.down('md')]: {
        right: 0,
      },
    }),
    dismiss: css({
      alignSelf: 'flex-end',
      marginBottom: theme.spacing(1),
    }),
    loading: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    }),
    loadingText: css({
      marginRight: theme.spacing(1),
    }),
  };
};
