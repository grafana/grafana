import { css } from '@emotion/css';

import { DataSourcePluginMeta, GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
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
  const styles = useStyles2(getStyles);

  return (
    <>
      {/* Categories */}
      {categories.map(({ id, title, plugins }) => (
        <div className={styles.category} key={id}>
          <div className={styles.header} id={id}>
            {title}
          </div>
          <DataSourceTypeCardList dataSourcePlugins={plugins} onClickDataSourceType={onClickDataSourceType} />
        </div>
      ))}

      {/* Find more */}
      <div className={styles.more}>
        <LinkButton variant="secondary" href={moreDataSourcesLink} target="_self" rel="noopener">
          Find more data source plugins
        </LinkButton>
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  category: css({
    marginBottom: theme.spacing(2),
  }),
  header: css({
    fontSize: theme.typography.h5.fontSize,
    marginBottom: theme.spacing(1),
  }),
  more: css({
    margin: theme.spacing(4),
    textAlign: 'center',
  }),
});
