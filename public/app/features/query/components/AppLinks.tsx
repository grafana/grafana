import { css } from '@emotion/css';
import { first } from 'lodash';

import { DataQuery, DataSourceRef, PluginExtensionPoints } from '@grafana/data';
import { QueryToAppPluginContext } from '@grafana/data/src/types/pluginExtensions';
import { usePluginLinks } from '@grafana/runtime';
import { Badge } from '@grafana/ui';

type Props = {
  query: DataQuery;
};

const moreButtonStyle = css({
  cursor: 'pointer',
});

export const AppLinks = ({ query }: Props) => {
  const context: QueryToAppPluginContext = {
    query,
    datasource: query.datasource as DataSourceRef,
  };

  const links = usePluginLinks({
    extensionPointId: PluginExtensionPoints.QueryToAppPlugin,
    context,
  });

  if (!context.datasource || links.links.length === 0) {
    return undefined;
  }

  const firstLink = first(links.links)!;

  return (
    <>
      <a href={firstLink.path} target="_blank" rel="noreferrer">
        <Badge className={moreButtonStyle} text={firstLink.title} color="orange" icon="rocket" />
      </a>
    </>
  );
};
