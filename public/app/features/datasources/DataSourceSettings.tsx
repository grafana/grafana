import React, { createRef, PureComponent } from 'react';
import { connect } from 'react-redux';
import { DataSource, NavModel, Plugin } from 'app/types';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import { importPluginModule } from '../plugins/plugin_loader';
import { loadDataSource } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getRouteParamsId } from '../../core/selectors/location';

export interface Props {
  navModel: NavModel;
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  pageId: number;
  loadDataSource: typeof loadDataSource;
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
  settingsElement = createRef<HTMLDivElement>();

  state = {
    name: this.props.dataSource.name,
    showNamePopover: false,
  };

  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
    importPluginModule(this.props.dataSourceMeta.module).then(pluginExports => {
      console.log(pluginExports);
    });
  }

  onNameChange = event => {
    this.setState({
      name: event.target.value,
    });
  };

  onSubmit = event => {
    event.preventDefault();
    console.log(event);
  };

  onDelete = event => {
    console.log(event);
  };

  onTogglePopover = () => {
    this.setState(prevState => ({
      showNamePopover: !prevState.showNamePopover,
    }));
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
    const { name, showNamePopover } = this.state;

    console.log(this.props);

    return (
      <div>
        <PageHeader model={this.props.navModel} />
        <div className="page-container page-body">
          <div>
            <form onSubmit={this.onSubmit}>
              <div className="gf-form-group">
                <div className="gf-form-inline">
                  <div className="gf-form max-width-30">
                    <span className="gf-form-label width-10">Name</span>
                    <input
                      className="gf-form-input max-width-23"
                      type="text"
                      value={name}
                      placeholder="Name"
                      onChange={this.onNameChange}
                      required
                    />
                    <div onClick={this.onTogglePopover}>
                      <i className="fa fa-info-circle" />
                    </div>
                    {showNamePopover && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '450px',
                          top: '-20px',
                          padding: '10px',
                          backgroundColor: 'black',
                          zIndex: 2,
                          width: '300px',
                          border: '1px solid gray',
                          borderRadius: '3px',
                        }}
                      >
                        The name is used when you select the data source in panels. The <em>Default</em> data source is
                        preselected in new panels.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {this.shouldRenderInfoBox() && <div className="grafana-info-box">{this.getInfoText()}</div>}
              {this.isReadyOnly() && (
                <div className="grafana-info-box span8">
                  This datasource was added by config and cannot be modified using the UI. Please contact your server
                  admin to update this datasource.
                </div>
              )}
              <div ref={this.settingsElement} />
              <div className="gf-form-button-row">
                <button type="submit" className="btn btn-success" disabled={this.isReadyOnly()} onClick={this.onSubmit}>
                  Save &amp; Test
                </button>
                <button type="submit" className="btn btn-danger" disabled={this.isReadyOnly()} onClick={this.onDelete}>
                  Delete
                </button>
                <a className="btn btn-inverse" href="datasources">
                  Back
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const pageId = getRouteParamsId(state.location);

  return {
    navModel: getNavModel(state.navIndex, `datasource-settings-${pageId}`),
    dataSource: state.dataSources.dataSource,
    dataSourceMeta: state.dataSources.dataSourceMeta,
    pageId: pageId,
  };
}

const mapDispatchToProps = {
  loadDataSource,
};

export default connect(mapStateToProps, mapDispatchToProps)(DataSourceSettings);
