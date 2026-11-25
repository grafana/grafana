import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled, targetIsElement } from 'app/features/logs/utils';

const MENU_WIDTH = 270;
const MENU_HEIGHT = 105;

interface PopoverState {
  selection: string;
  coordinates: { x: number; y: number };
}

const closedState: PopoverState = { selection: '', coordinates: { x: 0, y: 0 } };

interface Options {
  containerElement: HTMLElement | null;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
}

/**
 * Opens the logs popover menu when the user selects text inside a single cell of the logs table.
 */
export function useLogsTablePopoverMenu({ containerElement, onClickFilterString, onClickFilterOutString }: Options) {
  const [popoverState, setPopoverState] = useState<PopoverState>(closedState);
  const [showDisablePopoverOptions, setShowDisablePopoverOptions] = useState(false);
  const handleDeselectionRef = useRef<((e: Event) => void) | null>(null);

  const closePopoverMenu = useCallback(() => {
    if (handleDeselectionRef.current) {
      document.removeEventListener('click', handleDeselectionRef.current);
      document.removeEventListener('contextmenu', handleDeselectionRef.current);
      handleDeselectionRef.current = null;
    }
    setPopoverState(closedState);
  }, []);

  // Don't leave document listeners behind if the table unmounts with the menu open.
  useEffect(() => closePopoverMenu, [closePopoverMenu]);

  const handleDeselection = useCallback(
    (e: Event) => {
      if (targetIsElement(e.target) && !containerElement?.contains(e.target)) {
        closePopoverMenu();
        return;
      }
      // The click that finishes a selection also reaches this listener, so keep the menu while text is selected.
      if (document.getSelection()?.toString()) {
        return;
      }
      closePopoverMenu();
    },
    [closePopoverMenu, containerElement]
  );

  const handleTextSelection = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const selection = document.getSelection();
      const text = selection?.toString();
      if (!selection || !text || selection.rangeCount === 0) {
        return;
      }
      if (e.altKey) {
        enablePopoverMenu();
      }
      if (isPopoverMenuDisabled() || !(onClickFilterString || onClickFilterOutString) || !containerElement) {
        return;
      }

      // A selection spanning several cells has a common ancestor outside any cell; the filter only makes sense per cell.
      const ancestor = selection.getRangeAt(0).commonAncestorContainer;
      const ancestorElement = targetIsElement(ancestor) ? ancestor : ancestor.parentElement;
      if (!ancestorElement?.closest('[role="gridcell"]')) {
        return;
      }

      const x = e.clientX + MENU_WIDTH > window.innerWidth ? window.innerWidth - MENU_WIDTH : e.clientX;
      const y = e.clientY + MENU_HEIGHT > window.innerHeight ? window.innerHeight - MENU_HEIGHT : e.clientY;

      closePopoverMenu();
      setPopoverState({ selection: text, coordinates: { x, y } });
      handleDeselectionRef.current = handleDeselection;
      document.addEventListener('click', handleDeselection);
      document.addEventListener('contextmenu', handleDeselection);
    },
    [closePopoverMenu, containerElement, handleDeselection, onClickFilterOutString, onClickFilterString]
  );

  const onDisablePopoverMenu = useCallback(() => {
    closePopoverMenu();
    setShowDisablePopoverOptions(true);
  }, [closePopoverMenu]);

  const onDisableCancel = useCallback(() => {
    setShowDisablePopoverOptions(false);
  }, []);

  const onDisableConfirm = useCallback(() => {
    disablePopoverMenu();
    setShowDisablePopoverOptions(false);
  }, []);

  return {
    closePopoverMenu,
    handleTextSelection,
    onDisableCancel,
    onDisableConfirm,
    onDisablePopoverMenu,
    popoverState,
    showDisablePopoverOptions,
  };
}
