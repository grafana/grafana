import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ScrollContainer, Stack } from '@grafana/ui';

import { InfluxOptions } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { UrlAndConnectionSection } from './UrlAndConnectionSection';

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  return (
    <Stack>
      <LeftSideBar />
      <ScrollContainer scrollbarWidth="none" overflowY="auto" margin={2} minHeight={0} maxHeight="100vh">
        <Stack direction="column" width="75%">
          <UrlAndConnectionSection options={options} onOptionsChange={onOptionsChange} />
          <DatabaseConnectionSection options={options} onOptionsChange={onOptionsChange} />
        </Stack>
      </ScrollContainer>
    </Stack>
  );
};
