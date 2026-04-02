import { css, cx } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import React, { cloneElement, useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Portal, useStyles2 } from '@grafana/ui';

export function ControlActionsPopover({
  isEditable,
  content,
  children,
}: {
  isEditable: boolean;
  content: React.ReactNode;
  children: React.JSX.Element;
}) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top-start',
    middleware: [offset(0)],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { handleClose: safePolygon() });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  if (!isEditable) {
    return children;
  }

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps() })}
      {isOpen && content && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.popover} {...getFloatingProps()}>
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}

export function ControlEditActions({
  onClickEdit,
  onClickDelete,
}: {
  onClickEdit: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getStyles);

  const onClickEditInternal = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClickEdit();
    },
    [onClickEdit]
  );
  const onClickDeleteInternal = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClickDelete();
    },
    [onClickDelete]
  );

  return (
    <div className={styles.hoverActions}>
      <IconButton
        name="pen"
        variant="primary"
        size="md"
        className={cx(styles.action, styles.editAction)}
        onPointerDown={onClickEditInternal}
        aria-label={t('dashboard-scene.control-edit-actions.aria-label-edit', 'Edit')}
      />
      <div className={styles.actionsDivider} />
      <IconButton
        name="trash-alt"
        variant="destructive"
        size="md"
        className={cx(styles.action, styles.deleteAction)}
        onPointerDown={onClickDeleteInternal}
        aria-label={t('dashboard-scene.control-edit-actions.aria-label-delete', 'Delete')}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    zIndex: theme.zIndex.portal,
  }),
  hoverActions: css({
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z1,
    position: 'relative',
    top: '2px',
  }),
  actionsDivider: css({
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border.medium,
  }),
  action: css({
    margin: 0,
    color: theme.colors.text.primary,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['color'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
  editAction: css({
    '&:hover': {
      color: theme.colors.primary.text,
    },
  }),
  deleteAction: css({
    '&:hover': {
      color: theme.colors.error.text,
    },
  }),
});
