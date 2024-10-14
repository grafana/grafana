import { css } from '@emotion/css';
import { first } from 'lodash';
import { useEffect, useState } from 'react';

import { DataQuery, PluginExtensionPoints, PluginMeta } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { QueryToAppPluginContext } from '@grafana/data/src/types/pluginExtensions';
import { usePluginLinks } from '@grafana/runtime';
import { Link } from '@grafana/ui';
import { useStyles2, Tooltip } from '@grafana/ui/';

import { getPluginMeta } from '../../plugins/admin/api';

type Props = {
  query: DataQuery;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    goQueryLessLink: css({
      marginRight: '3px',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    goQueryLessIcon: css({
      marginLeft: '5px',
      marginTop: '-5px',
      width: '11px',
    }),
  };
}

export const AppLinks = ({ query }: Props) => {
  const context: QueryToAppPluginContext = {
    query,
    datasource: query.datasource,
  };

  const [plugin, setPlugin] = useState<PluginMeta | undefined>(undefined);

  const links = usePluginLinks({
    extensionPointId: PluginExtensionPoints.QueryToAppPlugin,
    context,
  });

  const styles = useStyles2(getStyles);

  const firstLink = first(links.links)!;

  useEffect(() => {
    firstLink?.pluginId && getPluginMeta(firstLink.pluginId).then(setPlugin);
  }, [firstLink?.pluginId]);

  if (links.links.length === 0 || !plugin) {
    return undefined;
  }

  return (
    <Tooltip content={firstLink.description}>
      <Link className={styles.goQueryLessLink} href={firstLink.path} target="_blank">
        Go Queryless
        <img className={styles.goQueryLessIcon} alt={firstLink.title} src={plugin.info.logos.small} />
      </Link>
    </Tooltip>
  );
};
