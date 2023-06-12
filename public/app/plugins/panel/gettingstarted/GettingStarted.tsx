// Libraries
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
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
    this.setState((prevState) => ({
      currentStep: prevState.currentStep + 1,
    }));
  };

  onPreviousClick = () => {
    this.setState((prevState) => ({
      currentStep: prevState.currentStep - 1,
    }));
  };

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
    const { checksDone, currentStep, steps } = this.state;
    const styles = getStyles();
    const step = steps[currentStep];

    return (
      <div className={styles.container}>
        {!checksDone ? (
          <div className={styles.loading}>
            <div className={styles.loadingText}>Checking completed setup steps</div>
            <Spinner size={24} inline />
          </div>
        ) : (
          <>
            <Button variant="secondary" fill="text" className={styles.dismiss} onClick={this.dismiss}>
              Remove this panel
            </Button>
            {currentStep === steps.length - 1 && (
              <Button
                className={cx(styles.backForwardButtons, styles.previous)}
                onClick={this.onPreviousClick}
                aria-label="To advanced tutorials"
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
                aria-label="To basic tutorials"
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
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      // background: url(public/img/getting_started_bg_${theme.colors.mode}.svg) no-repeat;
      background-size: cover;
      padding: ${theme.spacing(4)} ${theme.spacing(2)} 0;
    `,
    content: css`
      label: content;
      display: flex;
      justify-content: center;

      ${theme.breakpoints.down('xxl')} {
        margin-left: ${theme.spacing(3)};
        justify-content: flex-start;
      }
    `,
    header: css`
      label: header;
      margin-bottom: ${theme.spacing(3)};
      display: flex;
      flex-direction: column;

      ${theme.breakpoints.down('lg')} {
        flex-direction: row;
      }
    `,
    headerLogo: css`
      height: 58px;
      padding-right: ${theme.spacing(2)};
      display: none;

      ${theme.breakpoints.up('md')} {
        display: block;
      }
    `,
    heading: css`
      label: heading;
      margin-right: ${theme.spacing(3)};
      margin-bottom: ${theme.spacing(3)};
      flex-grow: 1;
      display: flex;

      ${theme.breakpoints.up('md')} {
        margin-bottom: 0;
      }
    `,
    backForwardButtons: css`
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    `,
    previous: css`
      left: 10px;

      ${theme.breakpoints.down('md')} {
        left: 0;
      }
    `,
    forward: css`
      right: 10px;

      ${theme.breakpoints.down('md')} {
        right: 0;
      }
    `,
    dismiss: css`
      align-self: flex-end;
      text-decoration: underline;
      margin-bottom: ${theme.spacing(1)};
    `,
    loading: css`
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    `,
    loadingText: css`
      margin-right: ${theme.spacing(1)};
    `,
  };
});
