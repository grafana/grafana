import { useMemo } from 'react';

import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, Tooltip } from '@grafana/ui';

interface ActionsProps {
  contentHeader?: boolean;
  isHidden: boolean;
  onDelete: () => void;
  onDuplicate?: () => void;
  onToggleHide: () => void;
  typeLabel: string;
}

interface ActionButtonConfig {
  id: string;
  icon: IconName;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function Actions({
  contentHeader = false,
  isHidden,
  onDelete,
  onDuplicate,
  onToggleHide,
  typeLabel,
}: ActionsProps) {
  const labels = useMemo(
    () => ({
      duplicate: t('query-editor-next.action.duplicate', 'Duplicate {{type}}', { type: typeLabel }),
      remove: t('query-editor-next.action.remove', 'Remove {{type}}', { type: typeLabel }),
      show: t('query-editor-next.action.show', 'Show {{type}}', { type: typeLabel }),
      hide: t('query-editor-next.action.hide', 'Hide {{type}}', { type: typeLabel }),
    }),
    [typeLabel]
  );

  const actionButtons = useMemo<ActionButtonConfig[]>(
    () =>
      [
        onDuplicate && {
          id: 'duplicate',
          icon: 'copy',
          label: labels.duplicate,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDuplicate();
          },
        },
        {
          id: 'delete',
          icon: 'trash-alt',
          label: labels.remove,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDelete();
          },
        },
        {
          id: 'toggle-hide',
          icon: isHidden ? 'eye-slash' : 'eye',
          label: isHidden ? labels.show : labels.hide,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onToggleHide();
          },
        },
      ].filter((btn): btn is ActionButtonConfig => Boolean(btn)),
    [labels, isHidden, onDelete, onDuplicate, onToggleHide]
  );

  return (
    <Stack direction="row" gap={contentHeader ? 1 : 0}>
      {actionButtons.map(({ label, id, icon, onClick }) => (
        <Tooltip content={label} key={id}>
          <Button size="sm" fill="text" icon={icon} variant="secondary" aria-label={label} onClick={onClick} />
        </Tooltip>
      ))}
    </Stack>
  );
}
