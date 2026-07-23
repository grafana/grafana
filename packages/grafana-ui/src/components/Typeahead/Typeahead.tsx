import { css } from '@emotion/css';
import { autoUpdate, offset, useFloating } from '@floating-ui/react';
import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { FixedSizeList } from 'react-window';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { type CompletionItem, type CompletionItemGroup, CompletionItemKind } from '../../types/completion';
import { SelectionReference } from '../../utils/SelectionReference';
import { getPositioningMiddleware } from '../../utils/floating';
import { flattenGroupItems, calculateLongestLabel, calculateListSizes } from '../../utils/typeahead';
import { Portal } from '../Portal/Portal';

import { TypeaheadInfo } from './TypeaheadInfo';
import { TypeaheadItem } from './TypeaheadItem';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);

interface Props {
  origin: string;
  groupedItems: CompletionItemGroup[];
  prefix?: string;
  menuRef?: (el: TypeaheadMenu) => void;
  onSelectSuggestion?: (suggestion: CompletionItem) => void;
  isOpen?: boolean;
}

/** Imperative handle exposed via the `menuRef` prop so the keyboard plugin can drive the menu. */
export interface TypeaheadMenu {
  moveMenuIndex: (moveAmount: number) => void;
  insertSuggestion: () => void;
}

function useTypeaheadList(groupedItems: CompletionItemGroup[]) {
  const theme = useTheme2();

  return useMemo(() => {
    const allItems = flattenGroupItems(groupedItems);
    const longestLabel = calculateLongestLabel(allItems);
    const { listWidth, listHeight, itemHeight } = calculateListSizes(theme, allItems, longestLabel);
    return { allItems, listWidth, listHeight, itemHeight };
  }, [groupedItems, theme]);
}

export function Typeahead({ prefix, isOpen = false, groupedItems, menuRef, onSelectSuggestion }: Props) {
  const listRef = useRef<FixedSizeList>(null);

  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [typeaheadIndex, setTypeaheadIndex] = useState<number | null>(null);
  const { allItems, listWidth, listHeight, itemHeight } = useTypeaheadList(groupedItems);

  // Reset the highlighted suggestion whenever the items change. Assigning state during render is the
  // React-recommended way to adjust state in response to a changed prop: it re-renders immediately
  // instead of committing the stale selection first, which an effect would not avoid.
  const [prevGroupedItems, setPrevGroupedItems] = useState(groupedItems);
  if (groupedItems !== prevGroupedItems) {
    setPrevGroupedItems(groupedItems);
    setTypeaheadIndex(null);
  }

  // The menu handle is stable, but the keyboard plugin invokes it outside of render, so the methods
  // read the latest props/state through a ref and functional state updates.
  const latest = useRef({ allItems, typeaheadIndex, onSelectSuggestion });
  latest.current = { allItems, typeaheadIndex, onSelectSuggestion };

  const menu = useMemo<TypeaheadMenu>(
    () => ({
      moveMenuIndex: (moveAmount: number) => {
        const itemCount = latest.current.allItems.length;
        if (!itemCount) {
          return;
        }
        setTypeaheadIndex((current) => {
          // Select next suggestion
          let newTypeaheadIndex = modulo((current || 0) + moveAmount, itemCount);

          if (latest.current.allItems[newTypeaheadIndex].kind === CompletionItemKind.GroupTitle) {
            newTypeaheadIndex = modulo(newTypeaheadIndex + moveAmount, itemCount);
          }

          return newTypeaheadIndex;
        });
      },
      insertSuggestion: () => {
        const { onSelectSuggestion, allItems, typeaheadIndex } = latest.current;
        if (onSelectSuggestion && typeaheadIndex !== null) {
          onSelectSuggestion(allItems[typeaheadIndex]);
        }
      },
    }),
    []
  );

  useEffect(() => {
    menuRef?.(menu);
  }, [menuRef, menu]);

  useEffect(() => {
    if (typeaheadIndex === null || !listRef.current) {
      return;
    }
    if (typeaheadIndex === 1) {
      listRef.current.scrollToItem(0); // special case for handling the first group label
      return;
    }
    listRef.current.scrollToItem(typeaheadIndex);
  }, [typeaheadIndex]);

  const styles = useStyles2(getStyles);

  const showDocumentation = hoveredItem || typeaheadIndex;
  const documentationItem = allItems[hoveredItem ? hoveredItem : typeaheadIndex || 0];

  return (
    <TypeaheadPortal isOpen={isOpen}>
      <ul role="menu" className={styles.typeahead} data-testid="typeahead">
        <FixedSizeList
          ref={listRef}
          itemCount={allItems.length}
          itemSize={itemHeight}
          itemKey={(index) => {
            const item = allItems && allItems[index];
            const key = item ? `${index}-${item.label}` : `${index}`;
            return key;
          }}
          width={listWidth}
          height={listHeight}
        >
          {({ index, style }) => {
            const item = allItems && allItems[index];
            if (!item) {
              return null;
            }

            return (
              <TypeaheadItem
                onClickItem={() => (onSelectSuggestion ? onSelectSuggestion(item) : {})}
                isSelected={typeaheadIndex === null ? false : allItems[typeaheadIndex] === item}
                item={item}
                prefix={prefix}
                style={style}
                onMouseEnter={() => setHoveredItem(index)}
                onMouseLeave={() => setHoveredItem(null)}
              />
            );
          }}
        </FixedSizeList>
      </ul>

      {showDocumentation && <TypeaheadInfo height={listHeight} item={documentationItem} />}
    </TypeaheadPortal>
  );
}

/**
 * Positions the typeahead menu next to the caret in the Slate editor and renders it into the
 * shared overlay portal. Uses floating-ui with a selection-anchored virtual reference, the same
 * pattern used by other caret-anchored menus (e.g. DataLinkInput).
 */
function TypeaheadPortal({ isOpen, children }: PropsWithChildren<{ isOpen: boolean }>) {
  const { refs, floatingStyles, update } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    // Mirror the previous manual offsets: 6px below the caret line, nudged 2px to the left.
    middleware: [offset({ mainAxis: 6, crossAxis: -2 }), ...getPositioningMiddleware('bottom-start')],
    whileElementsMounted: autoUpdate,
  });

  // Anchor positioning to the current text selection (the caret). Set once; the virtual element
  // reads the live selection rect on every reposition.
  useEffect(() => {
    refs.setReference(new SelectionReference());
  }, [refs]);

  // The caret moves as the user types or navigates, so reposition on selection changes while open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [isOpen, update]);

  if (!isOpen) {
    return null;
  }

  // The `slate-typeahead--open` class is a behavioural hook: keybindingSrv queries for it so the
  // global Esc handler defers to the typeahead while suggestions are open.
  return (
    <Portal>
      {/* display: flex lays the suggestion list and the documentation panel out side by side. */}
      <div ref={refs.setFloating} style={{ ...floatingStyles, display: 'flex' }} className="slate-typeahead--open">
        {children}
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  typeahead: css({
    position: 'relative',
    zIndex: theme.zIndex.typeahead,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.components.panel.borderColor}`,
    maxHeight: '66vh',
    overflowY: 'scroll',
    overflowX: 'hidden',
    outline: 'none',
    listStyle: 'none',
    background: theme.components.panel.background,
    color: theme.colors.text.primary,
    boxShadow: theme.shadows.z2,

    strong: {
      color: theme.v1.palette.yellow,
    },
  }),
});
