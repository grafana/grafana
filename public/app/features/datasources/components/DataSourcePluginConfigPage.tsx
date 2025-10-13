import { GenericDataSourcePlugin } from '../types';

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

  return <div>Page not found: {page}</div>;
}
