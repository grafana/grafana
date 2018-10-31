import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DataSource, NavModel, Plugin } from 'app/types/';
import PageHeader from '../../../core/components/PageHeader/PageHeader';
import PageLoader from '../../../core/components/PageLoader/PageLoader';
import PluginSettings from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';
import { loadDataSource, setDataSourceName } from '../state/actions';
import { getNavModel } from '../../../core/selectors/navModel';
import { getRouteParamsId } from '../../../core/selectors/location';
import { getDataSource, getDataSourceMeta } from '../state/selectors';

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

  isReadOnly() {
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
                <BasicSettings
                  dataSourceName={this.props.dataSource.name}
                  onChange={name => this.props.setDataSourceName(name)}
                />

                {this.shouldRenderInfoBox() && <div className="grafana-info-box">{this.getInfoText()}</div>}

                {this.isReadOnly() ? (
                  <div className="grafana-info-box span8">
                    This datasource was added by config and cannot be modified using the UI. Please contact your server
                    admin to update this datasource.
                  </div>
                ) : (
                  dataSourceMeta.module && <PluginSettings dataSource={dataSource} dataSourceMeta={dataSourceMeta} />
                )}

                <ButtonRow
                  onSubmit={event => this.onSubmit(event)}
                  isReadOnly={this.isReadOnly()}
                  onDelete={event => this.onDelete(event)}
                />
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
  const dataSource = getDataSource(state.dataSources, pageId);

  return {
    navModel: getNavModel(state.navIndex, `datasource-settings-${pageId}`),
    dataSource: getDataSource(state.dataSources, pageId),
    dataSourceMeta: getDataSourceMeta(state.dataSources, dataSource.type),
    pageId: pageId,
  };
}

const mapDispatchToProps = {
  loadDataSource,
  setDataSourceName,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceSettings));
