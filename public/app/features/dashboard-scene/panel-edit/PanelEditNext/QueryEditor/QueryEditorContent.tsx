import { Box } from '@grafana/ui';

import { ContentHeader } from './Header/ContentHeader';

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
      <ContentHeader />
    </Box>
  );
}
