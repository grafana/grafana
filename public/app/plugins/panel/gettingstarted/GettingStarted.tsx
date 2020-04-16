// Libraries
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { Button, stylesFactory } from '@grafana/ui';
import { css } from 'emotion';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import { getSteps } from './steps';

interface Stepz {
  title: string;
  cta?: string;
  icon: string;
  href: string;
  target?: string;
  note?: string;
  check: () => Promise<boolean>;
  done?: boolean;
}

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

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.heading}>
              <h1>{this.state.steps[0].heading}</h1>
              <p>{this.state.steps[0].subheading}</p>
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

          <Step step={this.state.steps[0]} />
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
  return {
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: url('public/img/getting_started_background.png') no-repeat;
      background-size: cover;
    `,
    content: css`
      margin-left: 410px;
      margin-top: 50px;
    `,
    header: css`
      margin-bottom: 85px;
      display: flex;
      flex-direction: row;
    `,
    heading: css`
      margin-right: 200px;
    `,
    help: css`
      width: 330px;
      padding-left: 16px;
      border-left: 3px solid pink;
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
