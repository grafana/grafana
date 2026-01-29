import { css } from '@emotion/css';
import { useState } from 'react';

import { CollapsableSection, Stack, Text } from '@grafana/ui';

export const QuerySidebarCollapsableHeader = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsableSection
      label={
        <Text color="secondary" variant="body">
          {label}
        </Text>
      }
      isOpen={isOpen}
      onToggle={setIsOpen}
      contentClassName={css({ padding: 0 })}
    >
      <Stack direction="column" gap={1}>
        {children}
      </Stack>
    </CollapsableSection>
  );
};
