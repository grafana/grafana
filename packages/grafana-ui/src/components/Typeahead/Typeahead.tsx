import { css } from '@emotion/css';
import { autoUpdate, offset, useFloating } from '@floating-ui/react';
import { isEqual } from 'lodash';
import { createRef, PureComponent, useEffect, type PropsWithChildren } from 'react';
import * as React from 'react';
import { FixedSizeList } from 'react-window';

import { type GrafanaTheme2, ThemeContext } from '@grafana/data';

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
  menuRef?: (el: Typeahead) => void;
  onSelectSuggestion?: (suggestion: CompletionItem) => void;
  isOpen?: boolean;
}

export interface State {
  allItems: CompletionItem[];
  listWidth: number;
  listHeight: number;
  itemHeight: number;
  hoveredItem: number | null;
  typeaheadIndex: number | null;
}

export class Typeahead extends PureComponent<Props, State> {
  static contextType = ThemeContext;
  context!: React.ContextType<typeof ThemeContext>;
  listRef = createRef<FixedSizeList>();

  state: State = {
    hoveredItem: null,
    typeaheadIndex: null,
    allItems: [],
    listWidth: -1,
    listHeight: -1,
    itemHeight: -1,
  };

  componentDidMount = () => {
    if (this.props.menuRef) {
      this.props.menuRef(this);
    }

    const allItems = flattenGroupItems(this.props.groupedItems);
    const longestLabel = calculateLongestLabel(allItems);
    const { listWidth, listHeight, itemHeight } = calculateListSizes(this.context, allItems, longestLabel);
    this.setState({
      listWidth,
      listHeight,
      itemHeight,
      allItems,
    });
  };

  componentDidUpdate = (prevProps: Readonly<Props>, prevState: Readonly<State>) => {
    if (
      this.state.typeaheadIndex !== null &&
      prevState.typeaheadIndex !== this.state.typeaheadIndex &&
      this.listRef &&
      this.listRef.current
    ) {
      if (this.state.typeaheadIndex === 1) {
        this.listRef.current.scrollToItem(0); // special case for handling the first group label
        return;
      }
      this.listRef.current.scrollToItem(this.state.typeaheadIndex);
    }

    if (isEqual(prevProps.groupedItems, this.props.groupedItems) === false) {
      const allItems = flattenGroupItems(this.props.groupedItems);
      const longestLabel = calculateLongestLabel(allItems);
      const { listWidth, listHeight, itemHeight } = calculateListSizes(this.context, allItems, longestLabel);
      this.setState({ listWidth, listHeight, itemHeight, allItems, typeaheadIndex: null });
    }
  };

  onMouseEnter = (index: number) => {
    this.setState({
      hoveredItem: index,
    });
  };

  onMouseLeave = () => {
    this.setState({
      hoveredItem: null,
    });
  };

  moveMenuIndex = (moveAmount: number) => {
    const itemCount = this.state.allItems.length;
    if (itemCount) {
      // Select next suggestion
      const typeaheadIndex = this.state.typeaheadIndex || 0;
      let newTypeaheadIndex = modulo(typeaheadIndex + moveAmount, itemCount);

      if (this.state.allItems[newTypeaheadIndex].kind === CompletionItemKind.GroupTitle) {
        newTypeaheadIndex = modulo(newTypeaheadIndex + moveAmount, itemCount);
      }

      this.setState({
        typeaheadIndex: newTypeaheadIndex,
      });

      return;
    }
  };

  insertSuggestion = () => {
    if (this.props.onSelectSuggestion && this.state.typeaheadIndex !== null) {
      this.props.onSelectSuggestion(this.state.allItems[this.state.typeaheadIndex]);
    }
  };

  render() {
    const { prefix, isOpen = false } = this.props;
    const { allItems, listWidth, listHeight, itemHeight, hoveredItem, typeaheadIndex } = this.state;
    const styles = getStyles(this.context);

    const showDocumentation = hoveredItem || typeaheadIndex;
    const documentationItem = allItems[hoveredItem ? hoveredItem : typeaheadIndex || 0];

    return (
      <TypeaheadPortal isOpen={isOpen}>
        <ul role="menu" className={styles.typeahead} data-testid="typeahead">
          <FixedSizeList
            ref={this.listRef}
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
                  onClickItem={() => (this.props.onSelectSuggestion ? this.props.onSelectSuggestion(item) : {})}
                  isSelected={typeaheadIndex === null ? false : allItems[typeaheadIndex] === item}
                  item={item}
                  prefix={prefix}
                  style={style}
                  onMouseEnter={() => this.onMouseEnter(index)}
                  onMouseLeave={this.onMouseLeave}
                />
              );
            }}
          </FixedSizeList>
        </ul>

        {showDocumentation && <TypeaheadInfo height={listHeight} item={documentationItem} />}
      </TypeaheadPortal>
    );
  }
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
