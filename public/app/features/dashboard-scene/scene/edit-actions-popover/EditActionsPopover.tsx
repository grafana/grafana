import { css, cx } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import React, { cloneElement, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, Portal, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

const ControlActionsPopoverContext = createContext<{ closePopover: () => void }>({ closePopover: () => {} });

/**
 * Lets popover content close the popover programmatically, e.g. before opening
 * a modal on top of it. Resolves to a no-op when rendered outside a popover.
 */
export const useControlActionsPopover = () => useContext(ControlActionsPopoverContext);

export function EditActionsPopover({
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

export function SettingsActionButton({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getStyles);
  return (
    <Button
      fill="text"
      variant="secondary"
      size="sm"
      className={cx(styles.action, styles.textAction)}
      onClick={onClick}
    >
      {t('dashboard-scene.control-edit-actions.settings', 'Settings')}
    </Button>
  );
}

export function CopyActionButton({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getStyles);
  return (
    <IconButton
      name="clipboard-alt"
      variant="secondary"
      size="md"
      className={styles.action}
      onClick={onClick}
      tooltip={t('dashboard-scene.control-edit-actions.copy-clipboard-tooltip', 'Copy to clipboard')}
      tooltipPlacement="top"
    />
  );
}

export function DuplicateActionButton({ onClick }: { onClick: () => void }) {
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

export function DeleteActionButton({
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

export const getStyles = (theme: GrafanaTheme2) => ({
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
    border: `1px solid ${theme.colors.border.strong}`,
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
    '&:hover, &:focus': {
      color: theme.colors.text.maxContrast,
      background: 'transparent',
    },
    '&:hover:before': {
      opacity: 0,
    },
  }),
  textAction: css({
    padding: 0,
    height: 'auto',
    fontWeight: theme.typography.fontWeightRegular,
  }),
  deleteAction: css({
    '&:hover': {
      color: theme.colors.error.text,
    },
  }),
});
