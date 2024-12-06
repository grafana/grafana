import type { ReactNode } from 'react';

import { Badge, Stack } from '@grafana/ui';

interface ShortcutBadgeProps {
  shortcut?: string[];
}

function ShortcutBadge({ shortcut }: ShortcutBadgeProps): ReactNode {
  if (!shortcut) {
    return null;
  }
  return (
    <Stack gap={1}>
      {shortcut
        .join('+')
        .split('')
        .map((singleKey, idx) =>
          singleKey === '+' ? <div key={idx}>+</div> : <Badge key={idx} text={singleKey} color="blue" />
        )}
    </Stack>
  );
}

export default ShortcutBadge;
