import { css, cx } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { AnnotationAlertState } from './AnnotationAlertState';
import { AnnotationAvatar } from './AnnotationAvatar';

export function AnnotationTooltipHeader(props: {
  className?: string;
  avatarImg?: string | undefined;
  alertState?: string | undefined;
  timeRange: string;
  canEdit: false | boolean;
  canDelete: boolean;
  isPinned: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const styles = useStyles2(getStyles);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (props.isPinned) {
      focusRef.current?.focus();
    }
  }, [props.isPinned]);

  return (
    <div className={props.className ? cx(props.className, styles.header) : styles.header}>
      <Stack gap={2} basis="100%" justifyContent="space-between" alignItems="center">
        <div className={styles.meta}>
          <span>
            <AnnotationAvatar src={props.avatarImg} />
            <AnnotationAlertState alertState={props.alertState} />
          </span>
          {props.timeRange}
        </div>
        {(props.canEdit || props.canDelete || props.isPinned) && (
          <div className={styles.controls}>
            {props.canEdit && (
              <IconButton
                ref={focusRef}
                name={'pen'}
                size={'sm'}
                onClick={props.onEdit}
                tooltip={t('timeseries.annotation-tooltip2.tooltip-edit', 'Edit')}
              />
            )}
            {props.canDelete && (
              <IconButton
                ref={props.canEdit ? null : focusRef}
                name={'trash-alt'}
                size={'sm'}
                onClick={props.onDelete}
                tooltip={t('timeseries.annotation-tooltip2.tooltip-delete', 'Delete')}
              />
            )}
            {props.onRemove && props.isPinned && (
              <IconButton
                ref={props.canEdit || props.canDelete ? null : focusRef}
                name={'times'}
                size={'sm'}
                onClick={props.onRemove}
                tooltip={t('timeseries.annotation-tooltip2.tooltip-close', 'Close')}
              />
            )}
          </div>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'initial',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    userSelect: 'text',
  }),
  header: css({
    label: 'annotation-header',
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
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
