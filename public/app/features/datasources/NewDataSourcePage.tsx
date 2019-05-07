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

interface DataSourceCategoryInfo {
  id: string;
  title: string;
}

class NewDataSourcePage extends PureComponent<Props> {
  categoryInfoList: DataSourceCategoryInfo[];

  constructor() {
    super();

    this.categoryInfoList = [
      { id: 'tsdb', title: 'Time series databases' },
      { id: 'sql', title: 'SQL databases' },
      { id: 'cloud', title: 'Cloud vendor services' },
      { id: 'other', title: 'Logging & Document DBs & Others' },
    ];
  }

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

    if (!dataSourceTypeSearchQuery && dataSourceTypes.length > 0) {
      const categories = dataSourceTypes.reduce(
        (accumulator, item) => {
          const category = item.category || 'other';
          const list = accumulator[category] || [];
          console.log(category);
          list.push(item);
          accumulator[category] = list;
          return accumulator;
        },
        {} as DataSourceCategories
      );

      return this.categoryInfoList.map(category => {
        return (
          <div className="add-data-source-category" key={category.id}>
            <div className="add-data-source-category__header">{category.title}</div>
            {this.renderTypes(categories[category.id])}
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
