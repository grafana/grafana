import React, { PureComponent, FC } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { addDataSource, loadDataSourceTypes, setDataSourceTypeSearchQuery } from './state/actions';
import { getDataSourceTypes } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { List } from '@grafana/ui';
import { DataSourcePluginMeta, NavModel, PluginType } from '@grafana/data';

export interface Props {
  navModel: NavModel;
  dataSourceTypes: DataSourcePluginMeta[];
  isLoading: boolean;
  addDataSource: typeof addDataSource;
  loadDataSourceTypes: typeof loadDataSourceTypes;
  searchQuery: string;
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
  searchInput: HTMLElement;
  categoryInfoList: DataSourceCategoryInfo[] = [
    { id: 'tsdb', title: 'Time series databases' },
    { id: 'logging', title: 'Logging & document databases' },
    { id: 'sql', title: 'SQL' },
    { id: 'cloud', title: 'Cloud' },
    { id: 'other', title: 'Others' },
  ];

  sortingRules: { [id: string]: number } = {
    prometheus: 100,
    graphite: 95,
    loki: 90,
    mysql: 80,
    postgres: 79,
    gcloud: -1,
  };

  componentDidMount() {
    this.props.loadDataSourceTypes();
    this.searchInput.focus();
  }

  onDataSourceTypeClicked = (plugin: DataSourcePluginMeta) => {
    this.props.addDataSource(plugin);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setDataSourceTypeSearchQuery(value);
  };

  renderTypes(types: DataSourcePluginMeta[]) {
    if (!types) {
      return null;
    }

    // apply custom sort ranking
    types.sort((a, b) => {
      const aSort = this.sortingRules[a.id] || 0;
      const bSort = this.sortingRules[b.id] || 0;
      if (aSort > bSort) {
        return -1;
      }
      if (aSort < bSort) {
        return 1;
      }

      return a.name > b.name ? -1 : 1;
    });

    return (
      <List
        items={types}
        getItemKey={item => item.id.toString()}
        renderItem={item => (
          <DataSourceTypeCard
            plugin={item}
            onClick={() => this.onDataSourceTypeClicked(item)}
            onLearnMoreClick={this.onLearnMoreClick}
          />
        )}
      />
    );
  }

  onLearnMoreClick = (evt: React.SyntheticEvent<HTMLElement>) => {
    evt.stopPropagation();
  };

  renderGroupedList() {
    const { dataSourceTypes } = this.props;

    if (dataSourceTypes.length === 0) {
      return null;
    }

    const categories = dataSourceTypes.reduce(
      (accumulator, item) => {
        const category = item.category || 'other';
        const list = accumulator[category] || [];
        list.push(item);
        accumulator[category] = list;
        return accumulator;
      },
      {} as DataSourceCategories
    );

    categories['cloud'].push(getGrafanaCloudPhantomPlugin());

    return (
      <>
        {this.categoryInfoList.map(category => (
          <div className="add-data-source-category" key={category.id}>
            <div className="add-data-source-category__header">{category.title}</div>
            {this.renderTypes(categories[category.id])}
          </div>
        ))}
        <div className="add-data-source-more">
          <a
            className="btn btn-inverse"
            href="https://grafana.com/plugins?type=datasource&utm_source=new-data-source"
            target="_blank"
            rel="noopener"
          >
            Find more data source plugins on grafana.com
          </a>
        </div>
      </>
    );
  }

  render() {
    const { navModel, isLoading, searchQuery, dataSourceTypes } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="page-action-bar">
            <div className="gf-form gf-form--grow">
              <FilterInput
                ref={elem => (this.searchInput = elem)}
                labelClassName="gf-form--has-input-icon"
                inputClassName="gf-form-input width-30"
                value={searchQuery}
                onChange={this.onSearchQueryChange}
                placeholder="Filter by name or type"
              />
            </div>
            <div className="page-action-bar__spacer" />
            <a className="btn btn-secondary" href="datasources">
              Cancel
            </a>
          </div>
          <div>
            {searchQuery && this.renderTypes(dataSourceTypes)}
            {!searchQuery && this.renderGroupedList()}
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

interface DataSourceTypeCardProps {
  plugin: DataSourcePluginMeta;
  onClick: () => void;
  onLearnMoreClick: (evt: React.SyntheticEvent<HTMLElement>) => void;
}

const DataSourceTypeCard: FC<DataSourceTypeCardProps> = props => {
  const { plugin, onLearnMoreClick } = props;
  const canSelect = plugin.id !== 'gcloud';
  const onClick = canSelect ? props.onClick : () => {};

  // find first plugin info link
  const learnMoreLink = plugin.info.links && plugin.info.links.length > 0 ? plugin.info.links[0].url : null;

  return (
    <div className="add-data-source-item" onClick={onClick} aria-label={`${plugin.name} datasource plugin`}>
      <img className="add-data-source-item-logo" src={plugin.info.logos.small} />
      <div className="add-data-source-item-text-wrapper">
        <span className="add-data-source-item-text">{plugin.name}</span>
        {plugin.info.description && <span className="add-data-source-item-desc">{plugin.info.description}</span>}
      </div>
      <div className="add-data-source-item-actions">
        {learnMoreLink && (
          <a
            className="btn btn-inverse"
            href={`${learnMoreLink}?utm_source=grafana_add_ds`}
            target="_blank"
            rel="noopener"
            onClick={onLearnMoreClick}
          >
            Learn more <i className="fa fa-external-link add-datasource-item-actions__btn-icon" />
          </a>
        )}
        {canSelect && <button className="btn btn-primary">Select</button>}
      </div>
    </div>
  );
};

function getGrafanaCloudPhantomPlugin(): DataSourcePluginMeta {
  return {
    id: 'gcloud',
    name: 'Grafana Cloud',
    type: PluginType.datasource,
    module: '',
    baseUrl: '',
    info: {
      description: 'Hosted Graphite, Prometheus and Loki',
      logos: { small: 'public/img/grafana_icon.svg', large: 'asd' },
      author: { name: 'Grafana Labs' },
      links: [
        {
          url: 'https://grafana.com/products/cloud/',
          name: 'Learn more',
        },
      ],
      screenshots: [],
      updated: '2019-05-10',
      version: '1.0.0',
    },
  };
}

export function getNavModel(): NavModel {
  const main = {
    icon: 'gicon gicon-add-datasources',
    id: 'datasource-new',
    text: 'Add data source',
    href: 'datasources/new',
    subTitle: 'Choose a data source type',
  };

  return {
    main: main,
    node: main,
  };
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(),
    dataSourceTypes: getDataSourceTypes(state.dataSources),
    searchQuery: state.dataSources.dataSourceTypeSearchQuery,
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
