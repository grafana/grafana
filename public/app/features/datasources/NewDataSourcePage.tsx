import React, { PureComponent, FC } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { addDataSource, loadDataSourceTypes, setDataSourceTypeSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSourceTypes } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { NavModel, DataSourcePluginMeta } from '@grafana/ui';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: DataSourcePluginMeta[];
  isLoading: boolean;
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  dataSourceTypeSearchQuery: string;
  setDataSourceTypeSearchQuery: typeof setDataSourceTypeSearchQuery;
}

interface DataSourceCategories {
  [key: string]: DataSourcePluginMeta[];
}

class NewDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadDataSourceTypes();
  }

  onDataSourceTypeClicked = (plugin: DataSourcePluginMeta) => {
    this.props.addDataSource(plugin);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setDataSourceTypeSearchQuery(value);
  };

  renderTypes(types: DataSourcePluginMeta[]) {
    return (
      <div className="add-data-source-grid">
        {types.map((plugin, index) => (
          <DataSourceTypeCard
            key={`${plugin.id}-${index}`}
            plugin={plugin}
            onClick={() => this.onDataSourceTypeClicked(plugin)}
          />
        ))}
      </div>
    );
  }

  renderList() {
    const { dataSourceTypes, dataSourceTypeSearchQuery } = this.props;

    if (!dataSourceTypeSearchQuery) {
      const categories = dataSourceTypes.reduce(
        (accumulator, item) => {
          const category = item.category || 'na';
          const list = (accumulator[category] = accumulator[category] || []);
          list.push(item);
          return accumulator;
        },
        {} as DataSourceCategories
      );

      return Object.keys(categories).map(category => {
        return (
          <div className="add-data-source-category" key={category}>
            <div className="add-data-source-category-header">{category}</div>
            {this.renderTypes(categories[category])}
          </div>
        );
      });
    }

    return this.renderTypes(dataSourceTypes);
  }

  render() {
    const { navModel, isLoading, dataSourceTypeSearchQuery } = this.props;
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
          <div>{this.renderList()}</div>
        </Page.Contents>
      </Page>
    );
  }
}

interface DataSourceTypeCardProps {
  plugin: DataSourcePluginMeta;
  onClick: () => void;
}

const DataSourceTypeCard: FC<DataSourceTypeCardProps> = props => {
  return (
    <div className="add-data-source-grid-item" onClick={props.onClick}>
      <img className="add-data-source-grid-item-logo" src={props.plugin.info.logos.small} />
      <span className="add-data-source-grid-item-text">{props.plugin.name}</span>
    </div>
  );
};

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
