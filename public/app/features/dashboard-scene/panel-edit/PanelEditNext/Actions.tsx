import { useCallback, useMemo, useState } from 'react';

import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ConfirmModal, Stack, Tooltip } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from './constants';

export interface ActionItem {
  name: string;
  type: QueryEditorType;
  isHidden: boolean;
}

interface ActionsProps {
  contentHeader?: boolean;
  handleResetFocus?: () => void;
  item: ActionItem;
  onDelete: () => void;
  onDuplicate?: () => void;
  onToggleHide: () => void;
}

interface ActionButtonConfig {
  id: string;
  icon: IconName;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function Actions({
  contentHeader = false,
  handleResetFocus,
  item,
  onDelete,
  onDuplicate,
  onToggleHide,
}: ActionsProps) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const config = QUERY_EDITOR_TYPE_CONFIG[item.type];
  const typeLabel = config.getLabel();
  const requiresDeleteConfirmation = config.deleteConfirmation;

  const labels = useMemo(
    () => ({
      duplicate: t('query-editor-next.action.duplicate', 'Duplicate {{type}}', { type: typeLabel }),
      remove: t('query-editor-next.action.remove', 'Remove {{type}}', { type: typeLabel }),
      show: t('query-editor-next.action.show', 'Show {{type}}', { type: typeLabel }),
      hide: t('query-editor-next.action.hide', 'Hide {{type}}', { type: typeLabel }),
    }),
    [typeLabel]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      handleResetFocus?.();

      if (requiresDeleteConfirmation) {
        setShowDeleteConfirmation(true);
      } else {
        onDelete();
      }
    },
    [requiresDeleteConfirmation, onDelete, handleResetFocus]
  );

  const handleConfirmDelete = useCallback(() => {
    onDelete();
    setShowDeleteConfirmation(false);
    handleResetFocus?.();
  }, [onDelete, handleResetFocus]);

  const handleDismissModal = useCallback(() => {
    setShowDeleteConfirmation(false);
    handleResetFocus?.();
  }, [handleResetFocus]);

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
          id: 'toggle-hide',
          icon: item.isHidden ? 'eye-slash' : 'eye',
          label: item.isHidden ? labels.show : labels.hide,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onToggleHide();
          },
        },
        {
          id: 'delete',
          icon: 'trash-alt',
          label: labels.remove,
          onClick: handleDelete,
        },
      ].filter((btn): btn is ActionButtonConfig => Boolean(btn)),
    [labels, item.isHidden, handleDelete, onDuplicate, onToggleHide]
  );

  return (
    <>
      <Stack direction="row" gap={contentHeader ? 1 : 0}>
        {actionButtons.map(({ label, id, icon, onClick }) => (
          <Tooltip content={label} key={id}>
            <Button size="sm" fill="text" icon={icon} variant="secondary" aria-label={label} onClick={onClick} />
          </Tooltip>
        ))}
      </Stack>

      {showDeleteConfirmation && (
        <ConfirmModal
          isOpen={showDeleteConfirmation}
          title={t('query-editor-next.delete-modal.title', 'Delete {{name}}?', { name: item.name })}
          body={null}
          description={
            item.type === QueryEditorType.Transformation
              ? t('query-editor-next.delete-modal.body-transformation', 'Removing one transformation may break others.')
              : t('query-editor-next.delete-modal.body-query', 'Are you sure you want to delete this query?')
          }
          confirmText={t('query-editor-next.delete-modal.confirm', 'Delete')}
          onConfirm={handleConfirmDelete}
          onDismiss={handleDismissModal}
        />
      )}
    </>
  );
}
