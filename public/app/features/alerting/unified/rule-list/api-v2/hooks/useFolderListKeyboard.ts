import { type KeyboardEvent, useCallback } from 'react';

export interface FolderListKeyboardHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface UseFolderListKeyboardOptions {
  flatKeys: string[];
  activeKey?: string;
  onActivate: (key: string) => void;
}

export function useFolderListKeyboard({
  flatKeys,
  activeKey,
  onActivate,
}: UseFolderListKeyboardOptions): FolderListKeyboardHandlers {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (flatKeys.length === 0) {
        return;
      }
      const currentIndex = activeKey ? flatKeys.indexOf(activeKey) : -1;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const next = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, flatKeys.length - 1);
          onActivate(flatKeys[next]);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const next = currentIndex <= 0 ? 0 : currentIndex - 1;
          onActivate(flatKeys[next]);
          break;
        }
        case 'Home': {
          event.preventDefault();
          onActivate(flatKeys[0]);
          break;
        }
        case 'End': {
          event.preventDefault();
          onActivate(flatKeys[flatKeys.length - 1]);
          break;
        }
        case 'Enter':
        case ' ': {
          if (activeKey) {
            event.preventDefault();
            onActivate(activeKey);
          }
          break;
        }
      }
    },
    [flatKeys, activeKey, onActivate]
  );

  return { onKeyDown };
}
