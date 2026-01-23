import { Box } from '@grafana/ui';

import { QueryEditorContentHeader } from './QueryEditorContentHeader';

export function QueryEditorContent() {
  return (
    <Box
      backgroundColor="primary"
      borderColor="weak"
      borderRadius="default"
      borderStyle="solid"
      height="100%"
      width="100%"
    >
      <QueryEditorContentHeader />
    </Box>
  );
}
