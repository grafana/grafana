import { useAsync } from 'react-use';

import { renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';

interface Props {
  pluginId: string;
}

export function PluginHelp({ pluginId }: Props) {
  const { value, loading, error } = useAsync(async () => {
    return getBackendSrv().get(`/api/plugins/${pluginId}/markdown/query_help`);
  }, []);

  const renderedMarkdown = renderMarkdown(value);

  if (loading) {
    return <LoadingPlaceholder text={t('plugins.plugin-help.loading', 'Loading help...')} />;
  }

  if (error) {
    return (
      <h3>
        <Trans i18nKey="plugins.plugin-help.error">An error occurred when loading help.</Trans>
      </h3>
    );
  }

  if (value === '') {
    return (
      <h3>
        <Trans i18nKey="plugins.plugin-help.not-found">No query help could be found.</Trans>
      </h3>
    );
  }

  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />;
}
