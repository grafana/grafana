import { Button, Divider, Stack } from '@grafana/ui';

import { getNotebookBlockTypeOptions, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  onAdd: (type: NotebookBlockType) => void;
}

/**
 * Always-visible row of add-block buttons at the bottom of the notebook, unlike the per-cell add button:
 * no hover-reveal, no dropdown — each button is already a single fixed type.
 */
export function NotebookFooterAddCell({ onAdd }: Props) {
  return (
    <>
      <Divider />
      <Stack direction="row" gap={1} wrap="wrap" alignItems="center">
        {getNotebookBlockTypeOptions().map((option) => (
          <Button key={option.type} variant="secondary" size="sm" icon={option.icon} onClick={() => onAdd(option.type)}>
            {option.label}
          </Button>
        ))}
      </Stack>
    </>
  );
}
