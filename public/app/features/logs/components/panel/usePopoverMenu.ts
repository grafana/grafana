import { useCallback, useRef, useState, MouseEvent } from 'react';

import { config } from '@grafana/runtime';

import { disablePopoverMenu, enablePopoverMenu, isPopoverMenuDisabled, targetIsElement } from '../../utils';
import { PopoverStateType } from '../LogRows';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

export const usePopoverMenu = (containerElement: HTMLDivElement | null) => {
  const [popoverState, setPopoverState] = useState<PopoverStateType>({
    selection: '',
    selectedRow: null,
    popoverMenuCoordinates: { x: 0, y: 0 },
  });
  const [showDisablePopoverOptions, setShowDisablePopoverOptions] = useState(false);
  const handleDeselectionRef = useRef<((e: Event) => void) | null>(null);
  const { onClickFilterOutString, onClickFilterString } = useLogListContext();

  const popoverMenuSupported = useCallback(() => {
    if (!config.featureToggles.logRowsPopoverMenu || isPopoverMenuDisabled()) {
      return false;
    }
    return Boolean(onClickFilterOutString || onClickFilterString);
  }, [onClickFilterOutString, onClickFilterString]);

  const closePopoverMenu = useCallback(() => {
    if (handleDeselectionRef.current) {
      document.removeEventListener('click', handleDeselectionRef.current);
      document.removeEventListener('contextmenu', handleDeselectionRef.current);
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
      if (document.getSelection()?.toString()) {
        return;
      }
      closePopoverMenu();
    },
    [closePopoverMenu, containerElement]
  );

  const handleTextSelection = useCallback(
    (e: MouseEvent<HTMLElement>, row: LogListModel): boolean => {
      const selection = document.getSelection()?.toString();
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
      const x = e.clientX + MENU_WIDTH > window.innerWidth ? window.innerWidth - MENU_WIDTH : e.clientX;
      const y = e.clientY + MENU_HEIGHT > window.innerHeight ? window.innerHeight - MENU_HEIGHT : e.clientY;

      setPopoverState({
        selection,
        popoverMenuCoordinates: { x, y },
        selectedRow: row,
      });
      handleDeselectionRef.current = handleDeselection;
      document.addEventListener('click', handleDeselection);
      document.addEventListener('contextmenu', handleDeselection);
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
