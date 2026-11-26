import { useCallback, useRef, useState, type MouseEvent } from 'react';

import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled, targetIsElement } from '../../utils';

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
  // The logs can render in another window than this one, such as a Document Picture-in-Picture window, and can move
  // there without rendering again. The text selection, the clicks that clear it and the viewport the menu fits in are
  // the window of the line the user selected in, so they're read from that line when the user selects.
  const selectionDocumentRef = useRef<Document>(document);
  const { onClickFilterOutString, onClickFilterString } = useLogListContext();

  const popoverMenuSupported = useCallback(() => {
    if (isPopoverMenuDisabled()) {
      return false;
    }
    return Boolean(onClickFilterOutString || onClickFilterString);
  }, [onClickFilterOutString, onClickFilterString]);

  const closePopoverMenu = useCallback(() => {
    if (handleDeselectionRef.current) {
      selectionDocumentRef.current.removeEventListener('click', handleDeselectionRef.current);
      selectionDocumentRef.current.removeEventListener('contextmenu', handleDeselectionRef.current);
      handleDeselectionRef.current = null;
    }
    setPopoverState({
      selection: '',
      popoverMenuCoordinates: { x: 0, y: 0 },
      selectedRow: null,
    });
  }, []);

  const handleDeselection = useCallback(
    (e: Event) => {
      if (targetIsElement(e.target) && !containerElement?.contains(e.target)) {
        // The mouseup event comes from outside the log rows, close the menu.
        closePopoverMenu();
        return;
      }
      if (selectionDocumentRef.current.getSelection()?.toString()) {
        return;
      }
      closePopoverMenu();
    },
    [closePopoverMenu, containerElement]
  );

  const handleTextSelection = useCallback(
    (e: MouseEvent<HTMLElement>, row: LogListModel): boolean => {
      const ownerDocument = e.currentTarget.ownerDocument;
      const ownerWindow = ownerDocument.defaultView ?? window;
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
      selectionDocumentRef.current = ownerDocument;
      ownerDocument.addEventListener('click', handleDeselection);
      ownerDocument.addEventListener('contextmenu', handleDeselection);
      return true;
    },
    [containerElement, handleDeselection, popoverMenuSupported]
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
