import { Box, InlineField, LinkButton, Space, Stack, Text } from '@grafana/ui';

import { CONFIG_SECTION_HEADERS } from './constants';

export const LeftSideBar = () => (
  <Stack>
    <Box flex={1} marginY={5}>
      <Text element="h4">InfluxDB</Text>
      <Box paddingTop={2} width="100%">
        {CONFIG_SECTION_HEADERS.map((header, index) => (
          <div key={index}>
            <InlineField label={`${index + 1}`} style={{ display: 'flex', alignItems: 'center' }} grow>
              <LinkButton
                variant="secondary"
                fill="text"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById(header.id);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                {header.label}
              </LinkButton>
            </InlineField>
            <Space v={1} />
          </div>
        ))}
      </Box>
    </Box>
  </Stack>
);
