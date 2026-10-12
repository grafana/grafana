import { Fragment } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';

interface FolderPathProps {
  /** Folder titles, root first. */
  segments: string[];
  /** Prefix the path with a folder icon (List mode metadata item). */
  showIcon?: boolean;
}

/** Folder titles joined by chevrons; never a slash, so it reads the same as the Folders-mode row. */
export function FolderPath({ segments, showIcon = true }: FolderPathProps) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      {showIcon && <Icon name="folder" size="xs" />}
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
