import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DataSource, NavModel, Plugin } from 'app/types';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import DataSourcePluginSettings from './DataSourcePluginSettings';
import { loadDataSource, setDataSourceName } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getRouteParamsId } from '../../core/selectors/location';
import { Label } from '../../core/components/Forms/Forms';
import PageLoader from '../../core/components/PageLoader/PageLoader';
import { getDataSource } from './state/selectors';

export interface Props {
  navModel: NavModel;
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  pageId: number;
  loadDataSource: typeof loadDataSource;
  setDataSourceName: typeof setDataSourceName;
}
interface State {
  name: string;
  showNamePopover: boolean;
}

enum DataSourceStates {
  Alpha = 'alpha',
  Beta = 'beta',
}

export class DataSourceSettings extends PureComponent<Props, State> {
  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
  }

  onSubmit = event => {
    event.preventDefault();
    console.log(event);
  };

  onDelete = event => {
    console.log(event);
  };

  isReadyOnly() {
    return this.props.dataSource.readOnly === true;
  }

  shouldRenderInfoBox() {
    const { state } = this.props.dataSourceMeta;

    return state === DataSourceStates.Alpha || state === DataSourceStates.Beta;
  }

  getInfoText() {
    const { dataSourceMeta } = this.props;

    switch (dataSourceMeta.state) {
      case DataSourceStates.Alpha:
        return (
          'This plugin is marked as being in alpha state, which means it is in early development phase and updates' +
          ' will include breaking changes.'
        );

      case DataSourceStates.Beta:
        return (
          'This plugin is marked as being in a beta development state. This means it is in currently in active' +
          ' development and could be missing important features.'
        );
    }

    return null;
  }

  render() {
    const { dataSource, dataSourceMeta, navModel } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        {Object.keys(dataSource).length === 0 && Object.keys(dataSourceMeta).length === 0 ? (
          <PageLoader pageName="Data source settings" />
        ) : (
          <div className="page-container page-body">
            <div>
              <form onSubmit={this.onSubmit}>
                <div className="gf-form-group">
                  <div className="gf-form max-width-30">
                    <Label
                      tooltip={
                        'The name is used when you select the data source in panels. The Default data source is' +
                        'preselected in new panels.'
                      }
                    >
                      Name
                    </Label>
                    <input
                      className="gf-form-input max-width-23"
                      type="text"
                      value={this.props.dataSource.name}
                      placeholder="Name"
                      onChange={event => this.props.setDataSourceName(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {this.shouldRenderInfoBox() && <div className="grafana-info-box">{this.getInfoText()}</div>}

                {this.isReadyOnly() ? (
                  <div className="grafana-info-box span8">
                    This datasource was added by config and cannot be modified using the UI. Please contact your server
                    admin to update this datasource.
                  </div>
                ) : (
                  <DataSourcePluginSettings dataSource={dataSource} dataSourceMeta={dataSourceMeta} />
                )}

                <div className="gf-form-button-row">
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={this.isReadyOnly()}
                    onClick={this.onSubmit}
                  >
                    Save &amp; Test
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={this.isReadyOnly()}
                    onClick={this.onDelete}
                  >
                    Delete
                  </button>
                  <a className="btn btn-inverse" href="/datasources">
                    Back
                  </a>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const pageId = getRouteParamsId(state.location);

  return {
    navModel: getNavModel(state.navIndex, `datasource-settings-${pageId}`),
    dataSource: getDataSource(state.dataSources, pageId),
    dataSourceMeta: state.dataSources.dataSourceMeta,
    pageId: pageId,
  };
}

const mapDispatchToProps = {
  loadDataSource,
  setDataSourceName,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceSettings));
