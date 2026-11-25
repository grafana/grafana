import { useCallback, useRef, useState, type MouseEvent } from 'react';

import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled } from '../../utils';

import { useLogListContext } from './LogListContext';
import { type PopoverStateType } from './popoverMenuTypes';
import { type LogListModel } from './processing';

export const usePopoverMenu = (containerElement: HTMLDivElement | null) => {
  const [popoverState, setPopoverState] = useState<PopoverStateType>({
    selection: '',
    selectedRow: null,
    popoverMenuCoordinates: { x: 0, y: 0 },
  });
  const [showDisablePopoverOptions, setShowDisablePopoverOptions] = useState(false);
  const handleDeselectionRef = useRef<((e: Event) => void) | null>(null);
  const { onClickFilterOutString, onClickFilterString } = useLogListContext();
  // The logs can render in another window than this one, such as a Document Picture-in-Picture window. The text
  // selection, the clicks that clear it and the viewport the menu fits in are that window's.
  const ownerDocument = containerElement?.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;

  const popoverMenuSupported = useCallback(() => {
    if (isPopoverMenuDisabled()) {
      return false;
    }
    return Boolean(onClickFilterOutString || onClickFilterString);
  }, [onClickFilterOutString, onClickFilterString]);

  const closePopoverMenu = useCallback(() => {
    if (handleDeselectionRef.current) {
      ownerDocument.removeEventListener('click', handleDeselectionRef.current);
      ownerDocument.removeEventListener('contextmenu', handleDeselectionRef.current);
      handleDeselectionRef.current = null;
    }
    setPopoverState({
      selection: '',
      popoverMenuCoordinates: { x: 0, y: 0 },
      selectedRow: null,
    });
  }, [ownerDocument]);

  const handleDeselection = useCallback(
    (e: Event) => {
      if (e.target instanceof ownerWindow.Element && !containerElement?.contains(e.target)) {
        // The mouseup event comes from outside the log rows, close the menu.
        closePopoverMenu();
        return;
      }
      if (ownerDocument.getSelection()?.toString()) {
        return;
      }
      closePopoverMenu();
    },
    [closePopoverMenu, containerElement, ownerDocument, ownerWindow]
  );

  const handleTextSelection = useCallback(
    (e: MouseEvent<HTMLElement>, row: LogListModel): boolean => {
      const selection = ownerDocument.getSelection()?.toString();
      if (!selection) {
        return false;
      }
      if (e.altKey) {
        enablePopoverMenu();
      }
      if (popoverMenuSupported() === false) {
        // This signals onRowClick inside LogRow to skip the event because the user is selecting text
        return selection ? true : false;
      }

      if (!containerElement) {
        return false;
      }

      const MENU_WIDTH = 270;
      const MENU_HEIGHT = 105;
      const { innerWidth, innerHeight } = ownerWindow;
      const x = e.clientX + MENU_WIDTH > innerWidth ? innerWidth - MENU_WIDTH : e.clientX;
      const y = e.clientY + MENU_HEIGHT > innerHeight ? innerHeight - MENU_HEIGHT : e.clientY;

      setPopoverState({
        selection,
        popoverMenuCoordinates: { x, y },
        selectedRow: row,
      });
      handleDeselectionRef.current = handleDeselection;
      ownerDocument.addEventListener('click', handleDeselection);
      ownerDocument.addEventListener('contextmenu', handleDeselection);
      return true;
    },
    [containerElement, handleDeselection, ownerDocument, ownerWindow, popoverMenuSupported]
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
};
