import { Box, Divider, InlineField, LinkButton, Space, Stack, Text } from '@grafana/ui';

import { CONFIG_SECTION_HEADERS } from './constants';

export const LeftSideBar = () => {
  const generateSectionHeaders = () => {
    return (
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
    );
  };

  return (
    <Stack>
      <Box flex={1} marginY={2}>
        <Text element="h2">InfluxDB</Text>
        <Space v={3} />
        {generateSectionHeaders()}
      </Box>
      <Divider direction="vertical" />
    </Stack>
  );
};
