// Libraries
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { Button, getButtonStyles, Icon, stylesFactory } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { css, cx } from 'emotion';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import { getSteps } from './steps';
import { Help } from './components/Help';

interface State {
  checksDone: boolean;
  currentStep: number;
}

export class GettingStarted extends PureComponent<PanelProps, State> {
  state = {
    checksDone: false,
    currentStep: 0,
    steps: getSteps(),
  };

  componentDidMount() {
    this.setState({
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
    dashboard.removePanel(panel);
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
    if (!checksDone) {
      return <div>checking...</div>;
    }

    const styles = getStyles();
    const step = steps[currentStep];
    return (
      <div className={styles.container}>
        <div>
          {currentStep === steps.length - 1 && (
            <div className={cx(styles.backForwardButtons, styles.previous)} onClick={this.onPreviousClick}>
              <Icon size="xl" name="angle-left" />
            </div>
          )}
          <div className={styles.content}>
            <div className={styles.header}>
              <div className={styles.heading}>
                <h1>{step.heading}</h1>
                <p>{step.subheading}</p>
              </div>
              <Help />
            </div>
            <Step step={step} />
          </div>
          {currentStep < steps.length - 1 && (
            <div className={cx(styles.backForwardButtons, styles.forward)} onClick={this.onForwardClick}>
              <Icon size="xl" name="angle-right" />
            </div>
          )}
        </div>
        <div className={styles.dismiss}>
          <Button variant="secondary" onClick={this.dismiss}>
            Remove this panel
          </Button>
        </div>
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: url(${theme.isDark
          ? 'public/img/getting_started_background_dark.png'
          : 'public/img/getting_started_background_light.png'})
        no-repeat;
      background-size: cover;
    `,
    content: css`
      margin-left: 350px;
      margin-top: 32px;
      margin-bottom: 16px;
    `,
    header: css`
      margin-bottom: 24px;
      display: flex;
      flex-direction: row;
    `,
    heading: css`
      margin-right: 200px;
      width: 40%;
    `,
    backForwardButtons: cx(
      getButtonStyles({ theme, size: 'md', variant: 'secondary', hasIcon: false, hasText: false }).button,
      css`
        position: absolute;
        right: 50px;
        bottom: 150px;
        height: 50px;
        display: flex;
        width: 20px;
        height: 50px;
        align-items: center;
        justify-content: center;
      `
    ),
    previous: css`
      left: 30px;
    `,
    forward: css`
      right: 30px;
    `,
    dismiss: css`
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    `,
  };
});
