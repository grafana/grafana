import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, Stack, TextLink, Text, useStyles2 } from '@grafana/ui';

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { CONTAINER_MIN_WIDTH } from './constants';
import { trackInfluxDBConfigV2FeedbackButtonClicked } from './tracking';
import { Props } from './types';

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <Stack justifyContent="space-between">
      <div className={styles.hideOnSmallScreen}>
        <Box width="100%" flex="1 1 auto">
          <LeftSideBar pdcInjected={options?.jsonData?.pdcInjected!!} />
        </Box>
      </div>
      <Box width="60%" flex="1 1 auto" minWidth={CONTAINER_MIN_WIDTH}>
        <Stack direction="column">
          <Alert severity="info" title="You are viewing a new design for the InfluxDB configuration settings." style={{ height: "100px" }}>
            <>
              <TextLink
                href="https://docs.google.com/forms/d/e/1FAIpQLSdi-zyX3c51vh937UKhNYYxhljUnFi6dQSlZv50mES9NrK-ig/viewform"
                external
                onClick={trackInfluxDBConfigV2FeedbackButtonClicked}
              >
                Share your thoughts
              </TextLink>{' '}
              to help us make it even better.
            </>
          </Alert>
          <Text color="secondary" element="p" italic>Fields marked with * are required</Text>
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    hideOnSmallScreen: css({
      width: '250px',
      flex: '0 0 250px',
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
  };
};
