// Libraries
import React from 'react';

// Types
import { RSSFeedOptions } from './types';

import { Forms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

interface Props extends DataSourcePluginOptionsEditorProps<RSSFeedOptions> {}

export const RSSFeedConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  const onChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        feedUrl: e.currentTarget.value,
      },
    });
  };

  return (
    <Forms.Field label="Feed url">
      <Forms.Input value={options.jsonData.feedUrl} onChange={onChange} />
    </Forms.Field>
  );
};
