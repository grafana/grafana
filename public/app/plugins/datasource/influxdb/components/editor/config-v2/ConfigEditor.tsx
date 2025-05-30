import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert, Box, Stack, TextLink } from '@grafana/ui';

import { InfluxOptions } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { trackInfluxDBConfigV2FeedbackButtonClicked } from './tracking';

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => (
  <Stack justifyContent="space-between">
    <Box width="20%">
      <LeftSideBar />
    </Box>
    <Box width="60%">
      <Stack direction="column">
        <Alert severity="info" title="You are viewing a new design for the InfluxDB configuration settings.">
          <>
            If something isn't working correctly, you can revert to the original configuration page design by disabling
            the <code>newInfluxDSConfigPageDesign</code> feature flag.{' '}
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
    </Box>
    <Box width="20%">{/* TODO: Right sidebar */}</Box>
  </Stack>
);
