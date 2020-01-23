import React, { FormEvent, PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { dateTime, NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { resetDashboard, fetchGcomDashboard } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

interface Props {
  navModel: NavModel;
  dashboard: any;
  inputs: any[];

  fetchGcomDashboard: typeof fetchGcomDashboard;
  resetDashboard: typeof resetDashboard;
}

interface State {
  gcomDashboard: string;
  dashboardJson: string;
  dashboardFile: any;
  gcomError: string;
}

const importStyles = stylesFactory(() => {
  return {
    option: css`
      margin-bottom: 32px;
    `,
  };
});

class DashboardImport extends PureComponent<Props, State> {
  static state = {
    gcomDashboard: '',
    dashboardJson: '',
    dashboardFile: '',
  };

  onGcomDashboardChange = (event: FormEvent<HTMLInputElement>) => {
    this.setState({ gcomDashboard: event.currentTarget.value });
  };

  getGcomDashboard = () => {
    const { gcomDashboard } = this.state;

    // From DashboardImportCtrl
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);
    let dashboardId;

    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    } else {
      this.setState({
        gcomError: 'Could not find dashboard',
      });
    }

    this.props.fetchGcomDashboard(dashboardId);
  };

  onSubmit = () => {};

  onCancel = () => {
    this.props.resetDashboard();
  };

  renderImportForm() {
    const styles = importStyles();

    return (
      <>
        <div className={styles.option}>
          <Forms.Legend>Import via .json file</Forms.Legend>
          <Forms.Button>Upload .json file</Forms.Button>
        </div>
        <div className={styles.option}>
          <Forms.Legend>Import via grafana.com</Forms.Legend>
          <Forms.Field>
            <Forms.Input
              size="md"
              placeholder="Grafana.com dashboard url or id"
              onChange={this.onGcomDashboardChange}
              addonAfter={<Forms.Button onClick={this.getGcomDashboard}>Load</Forms.Button>}
            />
          </Forms.Field>
        </div>
        <div className={styles.option}>
          <Forms.Legend>Import via panel json</Forms.Legend>
          <Forms.Field>
            <Forms.TextArea rows={10} />
          </Forms.Field>
          <Forms.Button>Load</Forms.Button>
        </div>
      </>
    );
  }

  renderSaveForm() {
    const { dashboard, inputs } = this.props;
    return (
      <>
        {dashboard.json.gnetId && (
          <>
            <div>
              <Forms.Legend>
                Importing Dashboard from{' '}
                <a
                  href={`https://grafana.com/dashboards/${dashboard.json.gnetId}`}
                  className="external-link"
                  target="_blank"
                >
                  Grafana.com
                </a>
              </Forms.Legend>
            </div>
            <Forms.Form>
              <table className="filter-table form-inline">
                <tbody>
                  <tr>
                    <td>Published by</td>
                    <td>{dashboard.orgName}</td>
                  </tr>
                  <tr>
                    <td>Updated on</td>
                    <td>{dateTime(dashboard.updatedAt).format()}</td>
                  </tr>
                </tbody>
              </table>
            </Forms.Form>
          </>
        )}
        <Forms.Form>
          <Forms.Legend className="section-heading">Options</Forms.Legend>
          <Forms.Field label="Name">
            <Forms.Input
              size="md"
              type="text"
              className="gf-form-input"
              value={dashboard.json.title}
              onChange={() => console.log('change')}
            />
          </Forms.Field>
          {inputs.map((input: any, index: number) => {
            if (input.type === 'datasource') {
              return (
                <Forms.Field label={input.label} key={`${input.label}-${index}`}>
                  <DataSourcePicker
                    datasources={input.options}
                    onChange={() => console.log('something changed')}
                    current={input.options[0]}
                  />
                </Forms.Field>
              );
            }
            return null;
          })}
          <div>
            <Forms.Button type="submit" variant="primary" onClick={this.onSubmit}>
              Import
            </Forms.Button>
            <Forms.Button type="reset" variant="secondary" onClick={this.onCancel}>
              Cancel
            </Forms.Button>
          </div>
        </Forms.Form>
      </>
    );
  }

  render() {
    const { dashboard, navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents>{dashboard.json ? this.renderSaveForm() : this.renderImportForm()}</Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'import', null, true),
    dashboard: state.importDashboard.dashboard,
    inputs: state.importDashboard.inputs,
  };
};

const mapDispatchToProps = {
  fetchGcomDashboard,
  resetDashboard,
};

export default connect(mapStateToProps, mapDispatchToProps)(DashboardImport);
