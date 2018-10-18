import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavModel, Plugin } from 'app/types';
import { addDataSource, loadDataSourceTypes, setDataSourceTypeSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSourceTypes } from './state/selectors';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: Plugin[];
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  dataSourceTypeSearchQuery: string;
  setDataSourceTypeSearchQuery: typeof setDataSourceTypeSearchQuery;
}

class NewDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadDataSourceTypes();
  }

  onDataSourceTypeClicked = type => {
    this.props.addDataSource(type);
  };

  onSearchQueryChange = event => {
    this.props.setDataSourceTypeSearchQuery(event.target.value);
  };

  render() {
    const { navModel, dataSourceTypes, dataSourceTypeSearchQuery } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h2 className="add-data-source-header">Choose data source type</h2>
          <div className="add-data-source-search">
            <label className="gf-form--has-input-icon">
              <input
                type="text"
                className="gf-form-input width-20"
                value={dataSourceTypeSearchQuery}
                onChange={this.onSearchQueryChange}
                placeholder="Filter by name or type"
              />
              <i className="gf-form-input-icon fa fa-search" />
            </label>
          </div>
          <div className="add-data-source-grid">
            {dataSourceTypes.map((type, index) => {
              return (
                <div
                  onClick={() => this.onDataSourceTypeClicked(type)}
                  className="add-data-source-grid-item"
                  key={`${type.id}-${index}`}
                >
                  <img className="add-data-source-grid-item-logo" src={type.info.logos.small} />
                  <span className="add-data-source-grid-item-text">{type.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'datasources'),
    dataSourceTypes: getDataSourceTypes(state.dataSources),
  };
}

const mapDispatchToProps = {
  addDataSource,
  loadDataSourceTypes,
  setDataSourceTypeSearchQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NewDataSourcePage));
