// Libraries
import React, { useState } from 'react';

// Types
import { RSSFeedOptions } from './types';

import { Forms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

interface Props extends DataSourcePluginOptionsEditorProps<RSSFeedOptions> {}

export const RSSFeedConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  const { feedUrl, proxyUrl } = options.jsonData;
  const [useProxy, setUseProxy] = useState(!!proxyUrl);
  const onChange = (key: string) => (e: React.SyntheticEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        [key]: e.currentTarget.value,
      },
    });
  };

  return (
    <>
      <Forms.Field label="Feed url">
        <Forms.Input value={feedUrl} onChange={onChange('feedUrl')} />
      </Forms.Field>

      <Forms.Field label="Use Proxy" description="When in trouble...">
        <Forms.Switch checked={useProxy} onChange={(_e, checked) => setUseProxy(checked)} />
      </Forms.Field>
      {useProxy && (
        <Forms.Field label="Proxy url">
          <Forms.Input value={proxyUrl || ''} onChange={onChange('proxyUrl')} />
        </Forms.Field>
      )}
    </>
  );
};
