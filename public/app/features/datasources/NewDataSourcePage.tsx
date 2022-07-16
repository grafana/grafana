import { css, cx } from '@emotion/css';
import React, { FC, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataSourcePluginMeta, GrafanaTheme2, NavModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Card, LinkButton, List, PluginSignatureBadge, FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { PluginsErrorsInfo } from '../plugins/components/PluginsErrorsInfo';

import { addDataSource, loadDataSourcePlugins } from './state/actions';
import { setDataSourceTypeSearchQuery } from './state/reducers';
import { getDataSourcePlugins } from './state/selectors';

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

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

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

  renderPlugins(plugins: DataSourcePluginMeta[], id?: string) {
    if (!plugins || !plugins.length) {
      return null;
    }

    return (
      <List
        items={plugins}
        className={css`
          > li {
            margin-bottom: 2px;
          }
        `}
        getItemKey={(item) => item.id.toString()}
        renderItem={(item) => (
          <DataSourceTypeCard
            plugin={item}
            onClick={() => this.onDataSourceTypeClicked(item)}
            onLearnMoreClick={this.onLearnMoreClick}
          />
        )}
        aria-labelledby={id}
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
        {categories.map((category) => (
          <div className="add-data-source-category" key={category.id}>
            <div className="add-data-source-category__header" id={category.id}>
              {category.title}
            </div>
            {this.renderPlugins(category.plugins, category.id)}
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
            <LinkButton href="datasources" fill="outline" variant="secondary" icon="arrow-left">
              Cancel
            </LinkButton>
          </div>
          {!searchQuery && <PluginsErrorsInfo />}
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

const DataSourceTypeCard: FC<DataSourceTypeCardProps> = (props) => {
  const { plugin, onLearnMoreClick } = props;
  const isPhantom = plugin.module === 'phantom';
  const onClick = !isPhantom && !plugin.unlicensed ? props.onClick : () => {};
  // find first plugin info link
  const learnMoreLink = plugin.info?.links?.length > 0 ? plugin.info.links[0] : null;

  const styles = useStyles2(getStyles);

  return (
    <Card className={cx(styles.card, 'card-parent')} onClick={onClick}>
      <Card.Heading
        className={styles.heading}
        aria-label={selectors.pages.AddDataSource.dataSourcePluginsV2(plugin.name)}
      >
        {plugin.name}
      </Card.Heading>
      <Card.Figure align="center" className={styles.figure}>
        <img className={styles.logo} src={plugin.info.logos.small} alt="" />
      </Card.Figure>
      <Card.Description className={styles.description}>{plugin.info.description}</Card.Description>
      {!isPhantom && (
        <Card.Meta className={styles.meta}>
          <PluginSignatureBadge status={plugin.signature} />
        </Card.Meta>
      )}
      <Card.Actions className={styles.actions}>
        {learnMoreLink && (
          <LinkButton
            variant="secondary"
            href={`${learnMoreLink.url}?utm_source=grafana_add_ds`}
            target="_blank"
            rel="noopener"
            onClick={onLearnMoreClick}
            icon="external-link-alt"
            aria-label={`${plugin.name}, learn more.`}
          >
            {learnMoreLink.name}
          </LinkButton>
        )}
      </Card.Actions>
    </Card>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    heading: css({
      fontSize: theme.v1.typography.heading.h5,
      fontWeight: 'inherit',
    }),
    figure: css({
      width: 'inherit',
      marginRight: '0px',
      '> img': {
        width: theme.spacing(7),
      },
    }),
    meta: css({
      marginTop: '6px',
      position: 'relative',
    }),
    description: css({
      margin: '0px',
      fontSize: theme.typography.size.sm,
    }),
    actions: css({
      position: 'relative',
      alignSelf: 'center',
      marginTop: '0px',
      opacity: 0,

      '.card-parent:hover &, .card-parent:focus-within &': {
        opacity: 1,
      },
    }),
    card: css({
      gridTemplateAreas: `
      "Figure   Heading   Actions"
      "Figure Description Actions"
      "Figure    Meta     Actions"
      "Figure     -       Actions"`,
    }),
    logo: css({
      marginRight: theme.v1.spacing.lg,
      marginLeft: theme.v1.spacing.sm,
      width: theme.spacing(7),
      maxHeight: theme.spacing(7),
    }),
  };
}

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

export default connector(NewDataSourcePage);
