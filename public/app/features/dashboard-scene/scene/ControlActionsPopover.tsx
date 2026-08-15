import { css, cx } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import React, { cloneElement, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CustomVariable, QueryVariable, type SceneDataLayerProvider, type SceneVariable } from '@grafana/scenes';
import { Button, IconButton, Portal, useStyles2 } from '@grafana/ui';
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
    placement: 'top-start',
    middleware: [offset(0)],
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
              {/* Stops pointerdown from all actions reaching ancestors, e.g. element selection.
              It cannot live on the icon buttons because their wrapping Tooltip overrides their pointerdown handlers */}
              <div className={styles.hoverActions} onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}>
                {content}
              </div>
            </ControlActionsPopoverContext.Provider>
          </div>
        </Portal>
      )}
    </>
  );
}

function SettingsActionButton({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getStyles);

  return (
    <Button
      fill="text"
      variant="secondary"
      size="sm"
      className={cx(styles.action, styles.editAction, styles.textAction)}
      onClick={onClick}
    >
      {t('dashboard-scene.control-edit-actions.settings', 'Settings')}
    </Button>
  );
}

function DuplicateActionButton({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getStyles);

  return (
    <IconButton
      name="copy"
      variant="secondary"
      size="md"
      className={styles.action}
      onClick={onClick}
      tooltip={t('dashboard-scene.control-edit-actions.duplicate-tooltip', 'Duplicate')}
      tooltipPlacement="top"
    />
  );
}

function DeleteActionButton({
  title,
  text,
  yesText,
  onConfirm,
}: {
  title: string;
  text: string;
  yesText: string;
  onConfirm: () => void;
}) {
  const styles = useStyles2(getStyles);
  const { closePopover } = useControlActionsPopover();

  const onClickInternal = useCallback(() => {
    closePopover();
    appEvents.publish(
      new ShowConfirmModalEvent({
        title,
        text,
        yesText,
        onConfirm,
      })
    );
  }, [closePopover, title, text, yesText, onConfirm]);

  return (
    <IconButton
      name="trash-alt"
      variant="destructive"
      size="md"
      className={cx(styles.action, styles.deleteAction)}
      onClick={onClickInternal}
      tooltip={t('dashboard-scene.control-edit-actions.delete-tooltip', 'Delete')}
      tooltipPlacement="top"
    />
  );
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
  const { closePopover } = useControlActionsPopover();
  const hasQueryEditor = variable instanceof QueryVariable || variable instanceof CustomVariable;

  const onClickEditQueryInternal = useCallback(() => {
    closePopover();
    onClickEditQuery();
  }, [onClickEditQuery, closePopover]);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      {hasQueryEditor && (
        <>
          <div className={styles.actionsDivider} />
          <Button
            fill="text"
            variant="secondary"
            size="sm"
            className={cx(styles.action, styles.textAction)}
            onClick={onClickEditQueryInternal}
          >
            {variable instanceof CustomVariable
              ? t('dashboard-scene.variable-edit-actions.edit-custom-values', 'Edit values')
              : t('dashboard-scene.variable-edit-actions.edit-query', 'Edit query')}
          </Button>
        </>
      )}
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.variable-editable-element.delete-title', 'Delete variable')}
        text={t('dashboard-scene.variable-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name: variable.state.name,
        })}
        yesText={t('dashboard-scene.variable-editable-element.delete-confirm', 'Delete variable')}
        onConfirm={onClickDelete}
      />
    </>
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
  const { closePopover } = useControlActionsPopover();

  const onClickEditQueryInternal = useCallback(() => {
    closePopover();
    onClickEditQuery();
  }, [onClickEditQuery, closePopover]);

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <Button
        fill="text"
        variant="secondary"
        size="sm"
        className={cx(styles.action, styles.textAction)}
        onClick={onClickEditQueryInternal}
      >
        {t('dashboard-scene.annotation-edit-actions.edit-query', 'Edit query')}
      </Button>
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.annotation-editable-element.delete-title', 'Delete annotation query')}
        text={t(
          'dashboard-scene.annotation-editable-element.delete-text',
          'Are you sure you want to delete: {{name}}?',
          { name: layer.state.name }
        )}
        yesText={t('dashboard-scene.annotation-editable-element.delete-confirm', 'Delete annotation query')}
        onConfirm={onClickDelete}
      />
    </>
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

  return (
    <>
      <SettingsActionButton onClick={onClickEdit} />
      <div className={styles.actionsDivider} />
      <DuplicateActionButton onClick={onClickDuplicate} />
      <DeleteActionButton
        title={t('dashboard-scene.link-editable-element.delete-title', 'Delete link')}
        text={t('dashboard-scene.link-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name,
        })}
        yesText={t('dashboard-scene.link-editable-element.delete-confirm', 'Delete link')}
        onConfirm={onClickDelete}
      />
    </>
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
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.components.dropdown.background,
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
  textAction: css({
    padding: 0,
    height: 'auto',
    fontWeight: theme.typography.fontWeightRegular,
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
