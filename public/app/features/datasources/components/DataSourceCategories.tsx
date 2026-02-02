import { css } from '@emotion/css';

import { DataSourcePluginMeta, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { DataSourcePluginCategory } from 'app/types';

// import { ROUTES } from '../../connections/constants';

import { DataSourceTypeCardList } from './DataSourceTypeCardList';

export type Props = {
  // The list of data-source plugin categories to display
  categories: DataSourcePluginCategory[];

  // Called when a data-source plugin is clicked on in the list
  onClickDataSourceType: (dataSource: DataSourcePluginMeta) => void;
};

export function DataSourceCategories({ categories, onClickDataSourceType }: Props) {
  // BMC Code: Commented next line.
  // const moreDataSourcesLink = `${ROUTES.AddNewConnection}?cat=data-source`;
  const styles = useStyles2(getStyles);

  // BMC Code: Commented below function, not in use
  // const handleClick = useCallback(() => {
  //   reportInteraction('connections_add_datasource_find_more_ds_plugins_clicked', {
  //     targetPath: moreDataSourcesLink,
  //     path: location.pathname,
  //     creator_team: 'grafana_plugins_catalog',
  //     schema_version: '1.0.0',
  //   });
  // }, [moreDataSourcesLink]);

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
      {/* BMC Change: Starts */}
      {/* <div className={styles.more}>
        <LinkButton variant="secondary" href={moreDataSourcesLink} onClick={handleClick} target="_self" rel="noopener">
          Find more data source plugins
        </LinkButton>
      </div> */}
      {/* BMC Change: Ends */}
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
