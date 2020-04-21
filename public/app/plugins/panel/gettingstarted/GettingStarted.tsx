// Libraries
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { Button, stylesFactory } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { css } from 'emotion';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import { getSteps } from './steps';

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
    const { checksDone } = this.state;
    if (!checksDone) {
      return <div>checking...</div>;
    }

    const styles = getStyles();
    const step = this.state.steps[1];

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.heading}>
              <h1>{step.heading}</h1>
              <p>{step.subheading}</p>
            </div>
            <div className={styles.help}>
              <h3>Need help?</h3>
              <div className={styles.helpOptions}>
                {['Documentation', 'Tutorials', 'Community', 'Public Slack'].map((item: string, index: number) => {
                  return (
                    <a href="" key={`${item}-${index}`} className={styles.helpOption}>
                      <Button
                        variant="primary"
                        size="md"
                        className={css`
                          width: 150px;
                          justify-content: center;
                        `}
                      >
                        {item}
                      </Button>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
          <Step step={step} />
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
      max-width: 40%;
    `,
    help: css`
      width: 330px;
      padding-left: 16px;
      border-left: 3px solid ${theme.palette.blue95};
    `,
    helpOptions: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    `,
    helpOption: css`
      margin-top: 8px;
    `,
    dismiss: css`
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    `,
  };
});
