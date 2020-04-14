import React, { FC, PureComponent } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { DataSourcePluginMeta, NavModel, SigningStatus } from '@grafana/data';
import { List, LinkButton, Button } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import Page from 'app/core/components/Page/Page';
import { DataSourcePluginCategory, StoreState } from 'app/types';
import { addDataSource, loadDataSourcePlugins } from './state/actions';
import { getDataSourcePlugins } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { setDataSourceTypeSearchQuery } from './state/reducers';

export interface Props {
  navModel: NavModel;
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
  isLoading: boolean;
  addDataSource: typeof addDataSource;
  loadDataSourcePlugins: typeof loadDataSourcePlugins;
  searchQuery: string;
  setDataSourceTypeSearchQuery: typeof setDataSourceTypeSearchQuery;
}

class NewDataSourcePage extends PureComponent<Props> {
  componentDidMount() {
    this.props.loadDataSourcePlugins();
  }

  onDataSourceTypeClicked = (plugin: DataSourcePluginMeta) => {
    this.props.addDataSource(plugin);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setDataSourceTypeSearchQuery(value);
  };

  renderPlugins(plugins: DataSourcePluginMeta[]) {
    if (!plugins || !plugins.length) {
      return null;
    }

    return (
      <List
        items={plugins}
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

  renderCategories() {
    const { categories } = this.props;

    return (
      <>
        {categories.map(category => (
          <div className="add-data-source-category" key={category.id}>
            <div className="add-data-source-category__header">{category.title}</div>
            {this.renderPlugins(category.plugins)}
          </div>
        ))}
        <div className="add-data-source-more">
          <LinkButton
            variant="secondary"
            href="https://grafana.com/plugins?type=datasource&utm_source=grafana_add_ds"
            target="_blank"
            rel="noopener"
          >
            Find more data source plugins on grafana.com
          </LinkButton>
        </div>
      </>
    );
  }

  render() {
    const { navModel, isLoading, searchQuery, plugins } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="page-action-bar">
            <FilterInput value={searchQuery} onChange={this.onSearchQueryChange} placeholder="Filter by name or type" />
            <div className="page-action-bar__spacer" />
            <LinkButton href="datasources">Cancel</LinkButton>
          </div>
          <div>
            {searchQuery && this.renderPlugins(plugins)}
            {!searchQuery && this.renderCategories()}
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
  const isPhantom = plugin.module === 'phantom';
  const onClick = !isPhantom ? props.onClick : () => {};

  // find first plugin info link
  const learnMoreLink = plugin.info.links && plugin.info.links.length > 0 ? plugin.info.links[0] : null;
  const mainClassName = classNames('add-data-source-item', {
    'add-data-source-item--phantom': isPhantom,
  });

  return (
    <div
      className={mainClassName}
      onClick={onClick}
      aria-label={e2e.pages.AddDataSource.selectors.dataSourcePlugins(plugin.name)}
    >
      <img className="add-data-source-item-logo" src={plugin.info.logos.small} />
      <div className="add-data-source-item-text-wrapper">
        <span className="add-data-source-item-text">{plugin.name}</span>
        {plugin.info.description && <span className="add-data-source-item-desc">{plugin.info.description}</span>}
        {!isPhantom && plugin.signature !== SigningStatus.internal && <SigningStatusInfo {...props} />}
      </div>
      <div className="add-data-source-item-actions">
        {learnMoreLink && (
          <LinkButton
            variant="secondary"
            href={`${learnMoreLink.url}?utm_source=grafana_add_ds`}
            target="_blank"
            rel="noopener"
            onClick={onLearnMoreClick}
            icon="external-link-alt"
          >
            {learnMoreLink.name}
          </LinkButton>
        )}
        {!isPhantom && <Button>Select</Button>}
      </div>
    </div>
  );
};

const SigningStatusInfo: FC<DataSourceTypeCardProps> = props => {
  const { plugin } = props;
  // TODO: make this look nicer... and should eventually be able to reuse it in the datasource page
  return (
    <>
      <span className="add-data-source-item-tag">{plugin.signature}</span>
      <span className="add-data-source-item-tag">{plugin.info.version}</span>
    </>
  );
};

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
    plugins: getDataSourcePlugins(state.dataSources),
    searchQuery: state.dataSources.dataSourceTypeSearchQuery,
    categories: state.dataSources.categories,
    isLoading: state.dataSources.isLoadingDataSources,
  };
}

const mapDispatchToProps = {
  addDataSource,
  loadDataSourcePlugins,
  setDataSourceTypeSearchQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NewDataSourcePage));
