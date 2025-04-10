// NOTE: will be implemented in a later iteration
import { Box, Text } from '@grafana/ui';

export const RightSideBar = () => {
  return (
    <Box width="20%">
      <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
        <Text element="h3">Column 3</Text>
      </Box>
      <Box borderStyle="solid" borderColor="weak" padding={2}>
        <Text element="h3">Column 3</Text>
      </Box>
    </Box>
  );
};
