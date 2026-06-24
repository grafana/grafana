import { Trans } from '@grafana/i18n';

import { type GenericDataSourcePlugin } from '../types';

export type Props = {
  plugin?: GenericDataSourcePlugin | null;
  pageId: string;
};

export function DataSourcePluginConfigPage({ plugin, pageId }: Props) {
  if (!plugin || !plugin.configPages) {
    return null;
  }

  const page = plugin.configPages.find(({ id }) => id === pageId);

  if (page) {
    // TODO: Investigate if any plugins are using this? We should change this interface
    return <page.body plugin={plugin} query={{}} />;
  }

<<<<<<< HEAD
  return <div>Страница не найденас: {page}</div>;
=======
  return (
    <div>
      <Trans i18nKey="datasources.data-source-plugin-config-page.page-not-found">Page not found: {{ page }}</Trans>
    </div>
  );
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
}
