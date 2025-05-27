import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert, Box, ScrollContainer, Stack, TextLink } from '@grafana/ui';

import { InfluxOptions } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { RightSideBar } from './RightSideBar';
import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { trackInfluxDBConfigV2FeedbackButtonClicked } from './tracking';

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  return (
    <Stack justifyContent="space-between">
      <Box width="20%">
        <LeftSideBar />
      </Box>
      <Box width="60%">
        <ScrollContainer
          scrollbarWidth="none"
          overflowY="auto"
          margin={2}
          minHeight={0}
          maxHeight="100vh"
          maxWidth="1440px"
          minWidth="400px"
        >
          <Stack direction="column">
            <Alert severity="info" title="">
              <>
                You are viewing a new design for InfluxDB configuration settings.{' '}
                <TextLink
                  href="https://github.com/grafana/grafana/issues"
                  external
                  onClick={trackInfluxDBConfigV2FeedbackButtonClicked}
                >
                  Submit feedback.
                </TextLink>
              </>
            </Alert>
            <UrlAndAuthenticationSection options={options} onOptionsChange={onOptionsChange} />
            <DatabaseConnectionSection options={options} onOptionsChange={onOptionsChange} />
          </Stack>
        </ScrollContainer>
      </Box>
      <Box width="20%">
        <RightSideBar />
      </Box>
    </Stack>
  );
};
