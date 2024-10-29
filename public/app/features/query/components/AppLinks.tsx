import { css } from '@emotion/css';
import { first } from 'lodash';
import { useEffect, useState } from 'react';

import { DataQuery, PluginExtensionPoints, PluginMeta } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { QueryToAppPluginContext } from '@grafana/data/src/types/pluginExtensions';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, LinkButton, ToolbarButton } from '@grafana/ui';
import { useStyles2, Tooltip } from '@grafana/ui/';

import { Trans } from '../../../core/internationalization';
import { ToolbarExtensionPointMenu } from '../../explore/extensions/ToolbarExtensionPointMenu';
import { getPluginMeta } from '../../plugins/admin/api';

type Props = {
  query: DataQuery;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    goQueryLessLink: css({
      marginRight: '3px',
      height: '20px',
      paddingLeft: '5px',
      paddingRight: '5px',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    goQueryLessIcon: css({
      marginLeft: '5px',
      marginTop: '-1px',
      width: '11px',
    }),
  };
}

export const AppLinks = ({ query }: Props) => {
  const context: QueryToAppPluginContext = {
    query,
    datasource: query.datasource,
  };

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [plugins, setPlugins] = useState<Record<string, PluginMeta> | undefined>(undefined);

  let links = usePluginLinks({
    extensionPointId: PluginExtensionPoints.QueryToAppPlugin,
    context,
  }).links;

  const styles = useStyles2(getStyles);

  useEffect(() => {
    links.forEach((link) => {
      getPluginMeta(link.pluginId).then((meta) => {
        setPlugins((plugins) => ({
          ...plugins,
          [link.pluginId]: meta,
        }));
      });
    });
  }, [links]);

  if (links.length === 0) {
    return undefined;
  }

  if (links.length === 1) {
    const link = first(links);
    const icon = plugins?.[link.pluginId].info.logos.small;
    return (
      <Tooltip content={link.description}>
        <LinkButton
          variant="secondary"
          fill="text"
          className={styles.goQueryLessLink}
          onClick={() => window.open(link.path, '_blank')}
        >
          <Trans i18nKey="query-operation.header.go-queryless">Go Queryless</Trans>
          {icon && <img className={styles.goQueryLessIcon} alt={link.title} src={icon} />}
        </LinkButton>
      </Tooltip>
    );
  } else {
    const menu = (
      <ToolbarExtensionPointMenu
        extensions={links}
        onSelect={(link) => link.path && window.open(link.path, '_blank')}
      />
    );
    return (
      <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
        <ToolbarButton aria-label="Go to" variant="canvas" isOpen={isOpen}>
          <Trans i18nKey="query-operation.header.go-to">Go to</Trans>
        </ToolbarButton>
      </Dropdown>
    );
  }
};
