import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { NavModel, Plugin, StoreState } from 'app/types';
import { addDataSource, loadDataSourceTypes, setDataSourceTypeSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSourceTypes } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: Plugin[];
  isLoading: boolean;
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  dataSourceTypeSearchQuery: string;
  setDataSourceTypeSearchQuery: typeof setDataSourceTypeSearchQuery;
}

class NewDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadDataSourceTypes();
  }

  onDataSourceTypeClicked = (plugin: Plugin) => {
    this.props.addDataSource(plugin);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setDataSourceTypeSearchQuery(value);
  };

  render() {
    const { navModel, dataSourceTypes, dataSourceTypeSearchQuery, isLoading } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <h2 className="add-data-source-header">Choose data source type</h2>
          <div className="add-data-source-search">
            <FilterInput
              labelClassName="gf-form--has-input-icon"
              inputClassName="gf-form-input width-20"
              value={dataSourceTypeSearchQuery}
              onChange={this.onSearchQueryChange}
              placeholder="Filter by name or type"
            />
          </div>
          <div className="add-data-source-grid">
            {dataSourceTypes.map((plugin, index) => {
              return (
                <div
                  onClick={() => this.onDataSourceTypeClicked(plugin)}
                  className="add-data-source-grid-item"
                  key={`${plugin.id}-${index}`}
                >
                  <img className="add-data-source-grid-item-logo" src={plugin.info.logos.small} />
                  <span className="add-data-source-grid-item-text">{plugin.name}</span>
                </div>
              );
            })}
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'datasources'),
    dataSourceTypes: getDataSourceTypes(state.dataSources),
    dataSourceTypeSearchQuery: state.dataSources.dataSourceTypeSearchQuery,
    isLoading: state.dataSources.isLoadingDataSources,
  };
}

const mapDispatchToProps = {
  addDataSource,
  loadDataSourceTypes,
  setDataSourceTypeSearchQuery,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(NewDataSourcePage)
);
