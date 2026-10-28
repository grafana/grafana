import { Fragment } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';

interface FolderPathProps {
  segments: string[];
}

export function FolderPath({ segments }: FolderPathProps) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      <Icon name="folder" size="xs" />
      <Text variant="bodySmall" color="secondary">
        <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
          {segments.map((segment, index) => (
            <Fragment key={index}>
              {index > 0 && <Icon name="angle-right" size="sm" />}
              <span>{segment}</span>
            </Fragment>
          ))}
        </Stack>
      </Text>
    </Stack>
  );
}
