import React from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { LinkButton } from '@grafana/ui';
import { DataSourcePluginCategory } from 'app/types';

import { ROUTES } from '../../connections/constants';

import { DataSourceTypeCardList } from './DataSourceTypeCardList';

export type Props = {
  // The list of data-source plugin categories to display
  categories: DataSourcePluginCategory[];

  // Called when a data-source plugin is clicked on in the list
  onClickDataSourceType: (dataSource: DataSourcePluginMeta) => void;
};

export function DataSourceCategories({ categories, onClickDataSourceType }: Props) {
  const moreDataSourcesLink = `${ROUTES.AddNewConnection}?cat=data-source`;

  return (
    <>
      {/* Categories */}
      {categories.map(({ id, title, plugins }) => (
        <div className="add-data-source-category" key={id}>
          <div className="add-data-source-category__header" id={id}>
            {title}
          </div>
          <DataSourceTypeCardList dataSourcePlugins={plugins} onClickDataSourceType={onClickDataSourceType} />
        </div>
      ))}

      {/* Find more */}
      <div className="add-data-source-more">
        <LinkButton variant="secondary" href={moreDataSourcesLink} target="_self" rel="noopener">
          Find more data source plugins
        </LinkButton>
      </div>
    </>
  );
}
