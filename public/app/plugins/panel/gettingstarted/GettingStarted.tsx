// Libraries
import { css, cx } from '@emotion/css';
import { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Spinner, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { Step } from './components/Step';
import { getSteps } from './steps';
import { SetupStep } from './types';

interface State {
  checksDone: boolean;
  currentStep: number;
  steps: SetupStep[];
}

export class GettingStarted extends PureComponent<PanelProps, State> {
  state = {
    checksDone: false,
    currentStep: 0,
    steps: getSteps(),
  };

  async componentDidMount() {
    const { steps } = this.state;

    const checkedStepsPromises: Array<Promise<SetupStep>> = steps.map(async (step: SetupStep) => {
      const checkedCardsPromises = step.cards.map(async (card) => {
        return card.check().then((passed) => {
          return { ...card, done: passed };
        });
      });
      const checkedCards = await Promise.all(checkedCardsPromises);
      return {
        ...step,
        done: checkedCards.every((c) => c.done),
        cards: checkedCards,
      };
    });

    const checkedSteps = await Promise.all(checkedStepsPromises);

    this.setState({
      currentStep: !checkedSteps[0].done ? 0 : 1,
      steps: checkedSteps,
      checksDone: true,
    });
  }

  onForwardClick = () => {
    reportInteraction('grafana_getting_started_button_to_advanced_tutorials');
    this.setState((prevState) => ({
      currentStep: prevState.currentStep + 1,
    }));
  };

  onPreviousClick = () => {
    reportInteraction('grafana_getting_started_button_to_basic_tutorials');
    this.setState((prevState) => ({
      currentStep: prevState.currentStep - 1,
    }));
  };

  dismiss = () => {
    const { id } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(id);

    reportInteraction('grafana_getting_started_remove_panel');

    dashboard?.removePanel(panel!);

    backendSrv.put('/api/user/helpflags/1', undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
    });
  };

  render() {
    const { checksDone, currentStep, steps } = this.state;
    const styles = getStyles();
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
            <Button variant="secondary" fill="text" className={styles.dismiss} onClick={this.dismiss}>
              <Trans i18nKey="gettingstarted.getting-started.remove-this-panel">Remove this panel</Trans>
            </Button>
            {currentStep === steps.length - 1 && (
              <Button
                className={cx(styles.backForwardButtons, styles.previous)}
                onClick={this.onPreviousClick}
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
                onClick={this.onForwardClick}
                aria-label={t(
                  'gettingstarted.getting-started.aria-label-to-advanced-tutorials',
                  'To advanced tutorials'
                )}
                icon="angle-right"
                variant="secondary"
              />
            )}
          </>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const theme = config.theme2;
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
      textDecoration: 'underline',
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
});
