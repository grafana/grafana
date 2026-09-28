import { useCallback } from 'react';

import { IconButton } from '@grafana/ui';

export function SidebarAddButton({
  onAdd,
  tooltip,
  dataTestId,
}: {
  onAdd: () => void;
  tooltip: string;
  dataTestId?: string;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onAdd();
    },
    [onAdd]
  );

  return (
    <IconButton
      name="plus"
      size="md"
      variant="secondary"
      onClick={handleClick}
      tooltip={tooltip}
      data-testid={dataTestId}
    />
  );
}
