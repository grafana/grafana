import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Spinner, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { Carousel } from './components/Carousel';
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
    const firstIncompleteStep = checkedSteps.findIndex((step) => !step.done);

    this.setState({
      currentStep: firstIncompleteStep === -1 ? checkedSteps.length - 1 : firstIncompleteStep,
      steps: checkedSteps,
      checksDone: true,
    });
  }

  dismiss = () => {
    const { id } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(id);

    dashboard?.removePanel(panel!);

    backendSrv.put('/api/user/helpflags/1', undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
    });
  };

  render() {
    const { checksDone, steps } = this.state;
    const styles = getStyles();

    // TODO: restore "Remove this panel" link / button

    return (
      <div className={styles.container}>
        {!checksDone ? (
          <div className={styles.loading}>
            <div className={styles.loadingText}>Checking completed setup steps</div>
            <Spinner size="xl" inline />
          </div>
        ) : (
          <Carousel page={this.state.currentStep}>
            {steps.map((step, index) => (
              <Step key={index} step={step} />
            ))}
          </Carousel>
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
