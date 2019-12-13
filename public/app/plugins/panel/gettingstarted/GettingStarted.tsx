// Libraries
import React, { PureComponent } from 'react';

import { PanelProps } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

interface Step {
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
}

export class GettingStarted extends PureComponent<PanelProps, State> {
  stepIndex = 0;
  readonly steps: Step[];

  constructor(props: PanelProps) {
    super(props);

    this.state = {
      checksDone: false,
    };

    this.steps = [
      {
        title: 'Install Grafana',
        icon: 'icon-gf icon-gf-check',
        href: 'http://docs.grafana.org/',
        target: '_blank',
        note: 'Review the installation docs',
        check: () => Promise.resolve(true),
      },
      {
        title: 'Create your first data source',
        cta: 'Add data source',
        icon: 'gicon gicon-datasources',
        href: 'datasources/new?gettingstarted',
        check: () => {
          return new Promise(resolve => {
            resolve(
              getDatasourceSrv()
                .getMetricSources()
                .filter(item => {
                  return item.meta.builtIn !== true;
                }).length > 0
            );
          });
        },
      },
      {
        title: 'Create your first dashboard',
        cta: 'New dashboard',
        icon: 'gicon gicon-dashboard',
        href: 'dashboard/new?gettingstarted',
        check: () => {
          return getBackendSrv()
            .search({ limit: 1 })
            .then(result => {
              return result.length > 0;
            });
        },
      },
      {
        title: 'Invite your team',
        cta: 'Add Users',
        icon: 'gicon gicon-team',
        href: 'org/users?gettingstarted',
        check: () => {
          return getBackendSrv()
            .get('/api/org/users/lookup')
            .then((res: any) => {
              return res.length > 1;
            });
        },
      },
      {
        title: 'Install apps & plugins',
        cta: 'Explore plugin repository',
        icon: 'gicon gicon-plugins',
        href: 'https://grafana.com/plugins?utm_source=grafana_getting_started',
        check: () => {
          return getBackendSrv()
            .get('/api/plugins', { embedded: 0, core: 0 })
            .then((plugins: any[]) => {
              return plugins.length > 0;
            });
        },
      },
    ];
  }

  componentDidMount() {
    this.stepIndex = -1;
    return this.nextStep().then((res: any) => {
      this.setState({ checksDone: true });
    });
  }

  nextStep(): any {
    if (this.stepIndex === this.steps.length - 1) {
      return Promise.resolve();
    }

    this.stepIndex += 1;
    const currentStep = this.steps[this.stepIndex];
    return currentStep.check().then(passed => {
      if (passed) {
        currentStep.done = true;
        return this.nextStep();
      }
      return Promise.resolve();
    });
  }

  dismiss = () => {
    const { id } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard.getPanelById(id);
    dashboard.removePanel(panel);
    getBackendSrv()
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

    return (
      <div className="progress-tracker-container">
        <button className="progress-tracker-close-btn" onClick={this.dismiss}>
          <i className="fa fa-remove" />
        </button>
        <div className="progress-tracker">
          {this.steps.map((step, index) => {
            return (
              <div key={index} className={step.done ? 'progress-step completed' : 'progress-step active'}>
                <a className="progress-link" href={step.href} target={step.target} title={step.note}>
                  <span className="progress-marker">
                    <i className={step.icon} />
                  </span>
                  <span className="progress-text">{step.title}</span>
                </a>
                <a className="btn-small progress-step-cta" href={step.href} target={step.target}>
                  {step.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}
