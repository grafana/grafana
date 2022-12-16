import React from 'react';
import { useAsync } from 'react-use';

import { renderMarkdown } from '@grafana/data';
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
    return <LoadingPlaceholder text="Loading help..." />;
  }

  if (error) {
    return <h3>Error occurred when loading help</h3>;
  }

  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />;
}
