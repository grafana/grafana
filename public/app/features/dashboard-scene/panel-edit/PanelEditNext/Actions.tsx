import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type AlertState, type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ConfirmModal, Icon, Stack, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { useQueryEditorTypeConfig } from './QueryEditor/QueryEditorContext';
import { QueryEditorType } from './constants';
import { trackCardAction, type CardActionSource } from './tracking';

export interface ActionItem {
  name: string;
  type: QueryEditorType;
  isHidden: boolean;
  error?: string;
  /** Alert state for dynamic styling (only used when type is Alert) */
  alertState?: AlertState | null;
}

interface ActionButtonConfig {
  id: string;
  icon: IconName;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

interface ActionsProps {
  contentHeader?: boolean;
  handleResetFocus?: () => void;
  item: ActionItem;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleHide?: () => void;
  order?: {
    delete: number;
    duplicate: number;
    hide: number;
  };
}

const getToggleLabel = (item: ActionItem, labels: Record<string, string>) => {
  const isTransformation = item.type === QueryEditorType.Transformation;
  const isHidden = item.isHidden;

  if (isTransformation) {
    return isHidden ? labels.enable : labels.disable;
  }
  return isHidden ? labels.show : labels.hide;
};

export function Actions({
  contentHeader = false,
  handleResetFocus,
  item,
  onDelete,
  onDuplicate,
  onToggleHide,
  order,
}: ActionsProps) {
  const theme = useTheme2();
  const typeConfig = useQueryEditorTypeConfig();
  const styles = useStyles2(getStyles);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const typeLabel = typeConfig[item.type].getLabel();
  const requiresDeleteConfirmation = typeConfig[item.type].deleteConfirmation;
  const cardActionSource: CardActionSource = contentHeader ? 'content_header' : 'sidebar_card';

  const labels = useMemo(
    () => ({
      duplicate: t('query-editor-next.action.duplicate', 'Duplicate {{type}}', { type: typeLabel }),
      remove: t('query-editor-next.action.remove', 'Remove {{type}}', { type: typeLabel }),
      show: t('query-editor-next.action.show', 'Show {{type}}', { type: typeLabel }),
      hide: t('query-editor-next.action.hide', 'Hide {{type}}', { type: typeLabel }),
      enable: t('query-editor-next.action.enable', 'Enable {{type}}', { type: typeLabel }),
      disable: t('query-editor-next.action.disable', 'Disable {{type}}', { type: typeLabel }),
    }),
    [typeLabel]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onDelete) {
        return;
      }

      handleResetFocus?.();

      if (requiresDeleteConfirmation) {
        setShowDeleteConfirmation(true);
      } else {
        trackCardAction('delete', item.type, cardActionSource);
        onDelete();
      }
    },
    [requiresDeleteConfirmation, onDelete, handleResetFocus, item.type, cardActionSource]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!onDelete) {
      return;
    }

    trackCardAction('delete', item.type, cardActionSource);
    onDelete();
    setShowDeleteConfirmation(false);
    handleResetFocus?.();
  }, [onDelete, handleResetFocus, item.type, cardActionSource]);

  const handleDismissModal = useCallback(() => {
    setShowDeleteConfirmation(false);
    handleResetFocus?.();
  }, [handleResetFocus]);

  const actionButtons = useMemo<ActionButtonConfig[]>(() => {
    const orderMap: Record<string, number> = {
      duplicate: order?.duplicate ?? 0,
      delete: order?.delete ?? 1,
      hide: order?.hide ?? 2,
    };

    return [
      onDuplicate && {
        id: 'duplicate',
        icon: 'copy',
        label: labels.duplicate,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          trackCardAction('duplicate', item.type, cardActionSource);
          onDuplicate();
        },
      },
      onDelete && {
        id: 'delete',
        icon: 'trash-alt',
        label: labels.remove,
        onClick: handleDelete,
      },
      onToggleHide && {
        id: 'hide',
        icon: item.isHidden ? 'eye-slash' : 'eye',
        label: getToggleLabel(item, labels),
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          trackCardAction('toggle_hide', item.type, cardActionSource);
          onToggleHide();
        },
      },
    ]
      .filter((btn): btn is ActionButtonConfig => Boolean(btn))
      .sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0));
  }, [order, onDuplicate, labels, onDelete, handleDelete, onToggleHide, item, cardActionSource]);

  return (
    <>
      <Stack direction="row" gap={contentHeader ? 1 : 0} alignItems="center">
        {actionButtons.map(({ label, id, icon, onClick }) => (
          <Tooltip content={label} key={id}>
            <Button size="sm" fill="text" icon={icon} variant="secondary" aria-label={label} onClick={onClick} />
          </Tooltip>
        ))}
        {!!item.error && (
          <Tooltip theme="error" content={item.error}>
            <Icon
              size="sm"
              name="exclamation-triangle"
              aria-label={t('query-editor-next.action.error', 'Error')}
              className={styles.errorIcon}
              color={theme.colors.error.text}
            />
          </Tooltip>
        )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  errorIcon: css({
    margin: theme.spacing(0, 0.5, 0, 0.5),
  }),
});
