// Libraries
import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { Button, Spinner, stylesFactory } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { css, cx } from 'emotion';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import imageDark from './img/Onboarding_Panel_dark.svg';
import imageLight from './img/Onboarding_Panel_light.svg';
import { getSteps } from './steps';
import { Card, SetupStep } from './types';

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
      const checkedCardsPromises: Array<Promise<Card>> = step.cards.map((card: Card) => {
        return card.check().then(passed => {
          return { ...card, done: passed };
        });
      });
      const checkedCards = await Promise.all(checkedCardsPromises);
      return {
        ...step,
        done: checkedCards.every(c => c.done),
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
    this.setState(prevState => ({
      currentStep: prevState.currentStep + 1,
    }));
  };

  onPreviousClick = () => {
    this.setState(prevState => ({
      currentStep: prevState.currentStep - 1,
    }));
  };

  dismiss = () => {
    const { id } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard.getPanelById(id);

    dashboard.removePanel(panel!);

    backendSrv
      .request({
        method: 'PUT',
        url: '/api/user/helpflags/1',
        showSuccessAlert: false,
      })
      .then((res: any) => {
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
            <div className={styles.dismiss}>
              <div onClick={this.dismiss}>Remove this panel</div>
            </div>
            {currentStep === steps.length - 1 && (
              <div className={cx(styles.backForwardButtons, styles.previous)} onClick={this.onPreviousClick}>
                <Button icon="angle-left" variant="secondary" />
              </div>
            )}
            <div className={styles.content}>
              <Step step={step} />
            </div>
            {currentStep < steps.length - 1 && (
              <div className={cx(styles.backForwardButtons, styles.forward)} onClick={this.onForwardClick}>
                <Button icon="angle-right" variant="secondary" />
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;
  const backgroundImage = theme.isDark ? imageDark : imageLight;
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: url(${backgroundImage}) no-repeat;
      background-size: cover;
      padding: ${theme.spacing.xl} ${theme.spacing.md} 0;
    `,
    content: css`
      label: content;
      display: flex;
      justify-content: center;

      @media only screen and (max-width: ${theme.breakpoints.xxl}) {
        margin-left: ${theme.spacing.lg};
        justify-content: flex-start;
      }
    `,
    header: css`
      label: header;
      margin-bottom: ${theme.spacing.lg};
      display: flex;
      flex-direction: column;

      @media only screen and (min-width: ${theme.breakpoints.lg}) {
        flex-direction: row;
      }
    `,
    headerLogo: css`
      height: 58px;
      padding-right: ${theme.spacing.md};
      display: none;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        display: block;
      }
    `,
    heading: css`
      label: heading;
      margin-right: ${theme.spacing.lg};
      margin-bottom: ${theme.spacing.lg};
      flex-grow: 1;
      display: flex;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        margin-bottom: 0;
      }
    `,
    backForwardButtons: css`
      position: absolute;
      bottom: 50%;
      top: 50%;
      height: 50px;
    `,
    previous: css`
      left: 10px;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        left: 0;
      }
    `,
    forward: css`
      right: 10px;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        right: 0;
      }
    `,
    dismiss: css`
      display: flex;
      justify-content: flex-end;
      cursor: pointer;
      text-decoration: underline;
      margin-right: ${theme.spacing.md};
      margin-bottom: ${theme.spacing.sm};
    `,
    loading: css`
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    `,
    loadingText: css`
      margin-right: ${theme.spacing.sm};
    `,
  };
});
