import { css } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import React, { cloneElement, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CustomVariable, QueryVariable, type SceneDataLayerProvider, type SceneVariable } from '@grafana/scenes';
import { Menu, Portal, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

const ControlActionsPopoverContext = createContext<{ closePopover: () => void }>({ closePopover: () => {} });

/**
 * Lets popover content close the popover programmatically, e.g. before opening
 * a modal on top of it. Resolves to a no-op when rendered outside a popover.
 */
const useControlActionsPopover = () => useContext(ControlActionsPopoverContext);

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
    placement: 'bottom-start',
    middleware: [offset(4)],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { handleClose: safePolygon() });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  const popoverContextValue = useMemo(() => ({ closePopover: () => setIsOpen(false) }), []);

  if (!isEditable) {
    return children;
  }

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps() })}
      {isOpen && content && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.popover} {...getFloatingProps()}>
            <ControlActionsPopoverContext.Provider value={popoverContextValue}>
              {content}
            </ControlActionsPopoverContext.Provider>
          </div>
        </Portal>
      )}
    </>
  );
}

function stopPointerDownPropagation(event: React.PointerEvent) {
  event.stopPropagation();
}

/**
 * Wraps an action handler so activating a menu item closes the popover and
 * does not bubble to ancestors, e.g. element selection.
 */
function useMenuAction(action: () => void) {
  const { closePopover } = useControlActionsPopover();

  return useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      closePopover();
      action();
    },
    [action, closePopover]
  );
}

function useDeleteMenuAction({
  title,
  text,
  yesText,
  onDelete,
}: {
  title: string;
  text: string;
  yesText: string;
  onDelete: () => void;
}) {
  const confirmDelete = useCallback(() => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title,
        text,
        yesText,
        onConfirm: onDelete,
      })
    );
  }, [title, text, yesText, onDelete]);

  return useMenuAction(confirmDelete);
}

export function VariableEditActions({
  variable,
  onClickEdit,
  onClickEditQuery,
  onClickDuplicate,
  onClickDelete,
}: {
  variable: SceneVariable;
  onClickEdit: () => void;
  onClickEditQuery: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getStyles);
  const hasQueryEditor = variable instanceof QueryVariable || variable instanceof CustomVariable;

  const onEdit = useMenuAction(onClickEdit);
  const onEditQuery = useMenuAction(onClickEditQuery);
  const onDuplicate = useMenuAction(onClickDuplicate);
  const onDelete = useDeleteMenuAction({
    title: t('dashboard-scene.variable-editable-element.delete-title', 'Delete variable'),
    text: t('dashboard-scene.variable-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
      name: variable.state.name,
    }),
    yesText: t('dashboard-scene.variable-editable-element.delete-confirm', 'Delete variable'),
    onDelete: onClickDelete,
  });

  return (
    // Stops pointerdown from all actions reaching ancestors, e.g. element selection
    <div className={styles.menuWrapper} onPointerDown={stopPointerDownPropagation}>
      <Menu>
        <Menu.Item
          label={t('dashboard-scene.variable-edit-actions.variable-settings', 'Variable settings')}
          icon="sliders-v-alt"
          onClick={onEdit}
        />
        {hasQueryEditor && (
          <Menu.Item
            label={
              variable instanceof CustomVariable
                ? t('dashboard-scene.variable-edit-actions.edit-custom-values', 'Edit values')
                : t('dashboard-scene.variable-edit-actions.edit-query', 'Edit query')
            }
            icon="pen"
            onClick={onEditQuery}
          />
        )}
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-duplicate', 'Duplicate')}
          icon="copy"
          onClick={onDuplicate}
        />
        <Menu.Divider />
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={onDelete}
        />
      </Menu>
    </div>
  );
}

export function AnnotationEditActions({
  layer,
  onClickEdit,
  onClickEditQuery,
  onClickDuplicate,
  onClickDelete,
}: {
  layer: SceneDataLayerProvider;
  onClickEdit: () => void;
  onClickEditQuery: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getStyles);
  const onEdit = useMenuAction(onClickEdit);
  const onEditQuery = useMenuAction(onClickEditQuery);
  const onDuplicate = useMenuAction(onClickDuplicate);
  const onDelete = useDeleteMenuAction({
    title: t('dashboard-scene.annotation-editable-element.delete-title', 'Delete annotation query'),
    text: t('dashboard-scene.annotation-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
      name: layer.state.name,
    }),
    yesText: t('dashboard-scene.annotation-editable-element.delete-confirm', 'Delete annotation query'),
    onDelete: onClickDelete,
  });

  return (
    // Stops pointerdown from all actions reaching ancestors, e.g. element selection
    <div className={styles.menuWrapper} onPointerDown={stopPointerDownPropagation}>
      <Menu>
        <Menu.Item
          label={t('dashboard-scene.annotation-edit-actions.annotation-settings', 'Annotation settings')}
          icon="sliders-v-alt"
          onClick={onEdit}
        />
        <Menu.Item
          label={t('dashboard-scene.annotation-edit-actions.edit-query', 'Edit query')}
          icon="pen"
          onClick={onEditQuery}
        />
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-duplicate', 'Duplicate')}
          icon="copy"
          onClick={onDuplicate}
        />
        <Menu.Divider />
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={onDelete}
        />
      </Menu>
    </div>
  );
}

export function LinkEditActions({
  name,
  onClickEdit,
  onClickDuplicate,
  onClickDelete,
}: {
  name: string;
  onClickEdit: () => void;
  onClickDuplicate: () => void;
  onClickDelete: () => void;
}) {
  const styles = useStyles2(getStyles);
  const onEdit = useMenuAction(onClickEdit);
  const onDuplicate = useMenuAction(onClickDuplicate);
  const onDelete = useDeleteMenuAction({
    title: t('dashboard-scene.link-editable-element.delete-title', 'Delete link'),
    text: t('dashboard-scene.link-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
      name,
    }),
    yesText: t('dashboard-scene.link-editable-element.delete-confirm', 'Delete link'),
    onDelete: onClickDelete,
  });

  return (
    // Stops pointerdown from all actions reaching ancestors, e.g. element selection
    <div className={styles.menuWrapper} onPointerDown={stopPointerDownPropagation}>
      <Menu>
        <Menu.Item
          label={t('dashboard-scene.link-edit-actions.link-settings', 'Link settings')}
          icon="sliders-v-alt"
          onClick={onEdit}
        />
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-duplicate', 'Duplicate')}
          icon="copy"
          onClick={onDuplicate}
        />
        <Menu.Divider />
        <Menu.Item
          label={t('dashboard-scene.control-edit-actions.aria-label-delete', 'Delete')}
          icon="trash-alt"
          destructive
          onClick={onDelete}
        />
      </Menu>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    zIndex: theme.zIndex.portal,
  }),
  // Match the font size of the dashboard controls the menu is attached to
  menuWrapper: css({
    '[role="menuitem"]': {
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
    },
  }),
});
