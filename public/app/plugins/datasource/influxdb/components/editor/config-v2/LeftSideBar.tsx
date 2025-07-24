import { Box, InlineField, LinkButton, Space, Stack, Text } from '@grafana/ui';

import { CONFIG_SECTION_HEADERS, CONFIG_SECTION_HEADERS_WITH_PDC } from './constants';

interface LeftSideBarProps {
  pdcInjected: boolean;
}

export const LeftSideBar = ({ pdcInjected }: LeftSideBarProps) => {
  const headers = pdcInjected ? CONFIG_SECTION_HEADERS_WITH_PDC : CONFIG_SECTION_HEADERS;
  return (
    <Stack>
      <Box flex={1} marginY={5}>
        <Text element="h4">InfluxDB</Text>
        <Box paddingTop={2}>
          {headers.map((header, index) => (
            <div key={index} data-testid={`${header.label}-sidebar`}>
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
};
