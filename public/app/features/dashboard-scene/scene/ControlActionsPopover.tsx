import { css, cx } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import React, { cloneElement, useCallback, useMemo, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { isDataLayer, isSceneObject, type SceneVariable, SceneVariableSet, type SceneObject } from '@grafana/scenes';
import { IconButton, Portal } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

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
  element,
  onClickEdit,
  onClickDelete,
}: {
  element: SceneObject | { name: string; type: string };
  onClickEdit: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getStyles);

  const { name, type } = useMemo(() => {
    if (!isSceneObject(element)) {
      return { name: element.name, type: element.type };
    }

    if (isDataLayer(element)) {
      return { name: element.state.name, type: 'annotation query' };
    }

    if (element.parent instanceof SceneVariableSet) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return { name: (element as SceneVariable).state.name, type: 'variable' };
    }

    return { name: '', type: 'unknown type' };
  }, [element]);

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
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: t('dashboard-scene.control-edit-actions.delete.title', 'Delete {{type}}', { type }),
          text: t('dashboard-scene.control-edit-actions.delete.confirm', 'Are you sure you want to delete: {{name}}?', {
            name,
          }),
          yesText: t('dashboard-scene.control-edit-actions.delete.text', 'Delete {{type}}', { type }),
          onConfirm: onClickDelete,
        })
      );
    },
    [name, type, onClickDelete]
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
