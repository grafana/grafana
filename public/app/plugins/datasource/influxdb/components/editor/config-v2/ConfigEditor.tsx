import React from 'react';

import { Alert, Box, Stack, TextLink } from '@grafana/ui';

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { trackInfluxDBConfigV2FeedbackButtonClicked } from './tracking';
import { Props } from './types';

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  return (
    <Stack justifyContent="space-between">
      <Box width="250px" flex="0 0 250px">
        <LeftSideBar pdcInjected={options?.jsonData?.pdcInjected!!} />
      </Box>
      <Box width="60%" flex="1 1 auto">
        <Stack direction="column">
          <Alert severity="info" title="You are viewing a new design for the InfluxDB configuration settings.">
            <>
              If something isn't working correctly, you can revert to the original configuration page design by
              disabling the <code>newInfluxDSConfigPageDesign</code> feature flag.{' '}
              <TextLink
                href="https://docs.google.com/forms/d/e/1FAIpQLSdi-zyX3c51vh937UKhNYYxhljUnFi6dQSlZv50mES9NrK-ig/viewform"
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
      <Box width="20%" flex="0 0 20%">
        {/* TODO: Right sidebar */}
      </Box>
    </Stack>
  );
};
