import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { AnnotationAlertState } from './AnnotationAlertState';
import { AnnotationAvatar } from './AnnotationAvatar';

export function AnnotationTooltipHeader({
  text,
  avatarImg,
  alertState,
  timeRange,
  canEdit,
  canDelete,
  isPinned,
  onEdit,
  onDelete,
  onRemove,
  isCluster = false,
}: {
  text?: string;
  avatarImg?: string | undefined;
  alertState?: string | undefined;
  timeRange: string;
  canEdit: false | boolean;
  canDelete: boolean;
  isPinned: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isCluster?: boolean;
}) {
  const styles = useStyles2(memoize(getStyles));
  const focusRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (isPinned) {
      focusRef.current?.focus();
    }
  }, [isPinned]);

  return (
    <div className={isCluster ? styles.clusterWrapper : styles.wrapper}>
      <div className={styles.header}>
        <Stack gap={2} basis="100%" justifyContent="space-between" alignItems="center">
          <div className={styles.meta}>
            <span>
              <AnnotationAvatar src={avatarImg} />
              <AnnotationAlertState alertState={alertState} />
            </span>
            {timeRange}
          </div>
          {(canEdit || canDelete || isPinned) && (
            <div className={styles.controls}>
              {canEdit && (
                <IconButton
                  ref={focusRef}
                  name={'pen'}
                  size={'sm'}
                  onClick={onEdit}
                  tooltip={t('timeseries.annotation-tooltip2.tooltip-edit', 'Edit')}
                />
              )}
              {canDelete && (
                <IconButton
                  ref={canEdit ? null : focusRef}
                  name={'trash-alt'}
                  size={'sm'}
                  onClick={onDelete}
                  tooltip={t('timeseries.annotation-tooltip2.tooltip-delete', 'Delete')}
                />
              )}
              {onRemove && isPinned && (
                <IconButton
                  ref={canEdit || canDelete ? null : focusRef}
                  name={'times'}
                  size={'sm'}
                  onClick={onRemove}
                  tooltip={t('timeseries.annotation-tooltip2.tooltip-close', 'Close')}
                />
              )}
            </div>
          )}
        </Stack>
      </div>
      {text && (
        <Stack gap={2} basis="100%" alignItems="center">
          <span className={styles.subHeader}>{text}</span>
        </Stack>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  subHeader: css({
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0, 1),
  }),
  clusterWrapper: css({
    background: theme.colors.background.elevated,
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 1,
    boxShadow: theme.shadows.z1,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  header: css({
    label: 'annotation-header',
    padding: theme.spacing(0.5, 1),
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.fontSize,
    color: theme.colors.text.primary,
    display: 'flex',
  }),
  meta: css({
    display: 'flex',
    color: theme.colors.text.primary,
    fontWeight: 400,
  }),
  controls: css({
    display: 'flex',
    '> :last-child': {
      marginLeft: 0,
    },
  }),
});
