import React from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { LinkButton } from '@grafana/ui';
import { DataSourcePluginCategory } from 'app/types';

import { DataSourceTypeCardList } from './DataSourceTypeCardList';

export type Props = {
  // The list of data-source plugin categories to display
  categories: DataSourcePluginCategory[];

  // Called when a data-source plugin is clicked on in the list
  onClickDataSourceType: (dataSource: DataSourcePluginMeta) => void;
};

export function DataSourceCategories({ categories, onClickDataSourceType }: Props) {
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
