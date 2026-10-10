import { type KeyboardEvent, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Menu, type IconName } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { hasSavedQueryReadPermissions } from 'app/features/explore/QueryLibrary/utils/identity';

/** The block types the add-block menu offers. Insertion itself belongs to edit mode. */
export type NotebookBlockType = 'heading' | 'paragraph' | 'code' | 'visualization';

export interface NotebookBlockTypeOption {
  type: NotebookBlockType;
  icon: IconName;
  label: string;
}

/** Shared by the dropdown menu below and the notebook's footer add-buttons, so the two can't drift apart. */
export function getNotebookBlockTypeOptions(): NotebookBlockTypeOption[] {
  return [
    { type: 'heading', icon: 'text-fields', label: t('notebook.add-block.heading', 'Heading') },
    { type: 'paragraph', icon: 'align-left', label: t('notebook.add-block.paragraph', 'Paragraph') },
    { type: 'code', icon: 'brackets-curly', label: t('notebook.add-block.code', 'Code') },
    { type: 'visualization', icon: 'graph-bar', label: t('notebook.add-block.visualization', 'Visualization') },
  ];
}

interface Props {
  onPick?: (type: NotebookBlockType) => void;
  /** Visualization sub-option, only offered when saved queries are available. */
  onPickSavedQuery?: () => void;
}

export function NotebookBlockTypeMenu({ onPick, onPickSavedQuery }: Props) {
  const { queryLibraryEnabled } = useQueryLibraryContext();
  const savedQueriesAvailable = queryLibraryEnabled && hasSavedQueryReadPermissions();

  const menuRef = useRef<HTMLDivElement>(null);
  // Focus has to move through Menu's own callback: focusing an item directly would leave Menu's
  // internal index behind, and the next ArrowUp/Down would step from the wrong item.
  const focusOnItemRef = useRef<((index: number) => void) | undefined>(undefined);

  const handleKeyDown = (event: KeyboardEvent) => {
    const hasOtherModifier = event.altKey || event.metaKey;
    // Lowercased so Caps Lock (or Shift) doesn't slip Ctrl+P past us to the browser's print shortcut.
    const key = event.key.toLocaleLowerCase();
    const isCtrlStep = event.ctrlKey && !hasOtherModifier && (key === 'n' || key === 'p');
    const isTypeAhead = event.key.length === 1 && !event.ctrlKey && !hasOtherModifier;
    if (!isCtrlStep && !isTypeAhead) {
      return;
    }

    const root = menuRef.current;
    const target = event.target;
    // A submenu renders nested inside this menu's DOM and handles its own keys.
    if (
      !root ||
      !focusOnItemRef.current ||
      !(target instanceof HTMLElement) ||
      target.closest('[role="menu"]') !== root
    ) {
      return;
    }

    // Same selector Menu uses, so indices line up with what focusOnItem expects.
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-role="menuitem"]:not([data-disabled])'));
    const current = items.indexOf(target);
    const step = (from: number, delta: number) => (from + delta + items.length) % items.length;

    if (isCtrlStep) {
      // On Windows/Linux, Ctrl+P is the browser's print shortcut.
      event.preventDefault();
      focusOnItemRef.current(step(current, key === 'n' ? 1 : -1));
      return;
    }

    for (let offset = 1; offset <= items.length; offset++) {
      const index = step(current, offset);
      const item = items[index];
      if (item.closest('[role="menu"]') === root && item.textContent?.trim().toLocaleLowerCase().startsWith(key)) {
        event.preventDefault();
        focusOnItemRef.current(index);
        return;
      }
    }
  };

  return (
    <Menu
      ref={menuRef}
      onOpen={(focusOnItem) => {
        focusOnItemRef.current = focusOnItem;
      }}
      onKeyDown={handleKeyDown}
    >
      {getNotebookBlockTypeOptions().map((option) => {
        if (option.type !== 'visualization' || !savedQueriesAvailable || !onPickSavedQuery) {
          return (
            <Menu.Item
              key={option.type}
              icon={option.icon}
              label={option.label}
              onClick={() => onPick?.(option.type)}
            />
          );
        }

        // A plain array, not a component that could render null: Menu.Item opens a submenu based on
        // childItems.length alone, which would still be > 0 for a null child.
        //
        // Child clicks must keep bubbling — a host Dropdown only closes on a click that reaches its
        // overlay wrapper — so the parent's own onClick filters them out instead of children stopping
        // propagation.
        const childItems = [
          <Menu.Item
            key="new-visualization"
            icon="plus"
            label={t('notebook.add-block.new-visualization', 'New Visualization')}
            onClick={() => onPick?.(option.type)}
          />,
          <Menu.Item
            key="new-from-saved-queries"
            icon="book-open"
            label={t('notebook.add-block.new-from-saved-queries', 'New from Saved Queries')}
            onClick={onPickSavedQuery}
          />,
        ];

        return (
          <Menu.Item
            key={option.type}
            icon={option.icon}
            label={option.label}
            onClick={(event) => {
              const clickedItem = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
              if (clickedItem === event.currentTarget) {
                onPick?.(option.type);
              }
            }}
            childItems={childItems}
          />
        );
      })}
    </Menu>
  );
}
