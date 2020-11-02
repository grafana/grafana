import React, { FC, PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { DataSourcePluginMeta, NavModel } from '@grafana/data';
import { Button, LinkButton, List } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import Page from 'app/core/components/Page/Page';
import { DataSourcePluginCategory, StoreState } from 'app/types';
import { addDataSource, loadDataSourcePlugins } from './state/actions';
import { getDataSourcePlugins } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { setDataSourceTypeSearchQuery } from './state/reducers';
import { PluginSignatureBadge } from '../plugins/PluginSignatureBadge';
import { Card } from 'app/core/components/Card/Card';
import { PluginsErrorsInfo } from '../plugins/PluginsErrorsInfo';

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
          {!searchQuery && (
            <PluginsErrorsInfo>
              <>
                <br />
                <p>
                  Note that <strong>unsigned front-end datasource plugins</strong> are still usable, but this is subject
                  to change in the upcoming releases of Grafana
                </p>
              </>
            </PluginsErrorsInfo>
          )}
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
  const onClick = !isPhantom && !plugin.unlicensed ? props.onClick : () => {};
  // find first plugin info link
  const learnMoreLink = plugin.info?.links?.length > 0 ? plugin.info.links[0] : null;

  return (
    <Card
      title={plugin.name}
      description={plugin.info.description}
      ariaLabel={selectors.pages.AddDataSource.dataSourcePlugins(plugin.name)}
      logoUrl={plugin.info.logos.small}
      actions={
        <>
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
          {!isPhantom && <Button disabled={plugin.unlicensed}>Select</Button>}
        </>
      }
      labels={
        !isPhantom && (
          <div>
            <PluginSignatureBadge status={plugin.signature} />
          </div>
        )
      }
      className={isPhantom ? 'add-data-source-item--phantom' : ''}
      onClick={onClick}
      aria-label={selectors.pages.AddDataSource.dataSourcePlugins(plugin.name)}
    />
  );
};

export function getNavModel(): NavModel {
  const main = {
    icon: 'database',
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
