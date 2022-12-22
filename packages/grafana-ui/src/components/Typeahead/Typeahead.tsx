import { isEqual } from 'lodash';
import React, { createRef, PureComponent } from 'react';
import ReactDOM from 'react-dom';
import { FixedSizeList } from 'react-window';

import { ThemeContext } from '../../themes/ThemeContext';
import { CompletionItem, CompletionItemGroup, CompletionItemKind } from '../../types/completion';
import { flattenGroupItems, calculateLongestLabel, calculateListSizes } from '../../utils/typeahead';

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

    document.addEventListener('selectionchange', this.handleSelectionChange);

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

  componentWillUnmount = () => {
    document.removeEventListener('selectionchange', this.handleSelectionChange);
  };

  handleSelectionChange = () => {
    this.forceUpdate();
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

  get menuPosition(): string {
    // Exit for unit tests
    if (!window.getSelection) {
      return '';
    }

    const selection = window.getSelection();
    const node = selection && selection.anchorNode;

    // Align menu overlay to editor node
    if (node && node.parentElement) {
      // Read from DOM
      const rect = node.parentElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      return `position: absolute; display: flex; top: ${rect.top + scrollY + rect.height + 6}px; left: ${
        rect.left + scrollX - 2
      }px`;
    }

    return '';
  }

  render() {
    const { prefix, isOpen = false, origin } = this.props;
    const { allItems, listWidth, listHeight, itemHeight, hoveredItem, typeaheadIndex } = this.state;

    const showDocumentation = hoveredItem || typeaheadIndex;
    const documentationItem = allItems[hoveredItem ? hoveredItem : typeaheadIndex || 0];

    return (
      <Portal origin={origin} isOpen={isOpen} style={this.menuPosition}>
        <ul role="menu" className="typeahead" data-testid="typeahead">
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
      </Portal>
    );
  }
}

interface PortalProps {
  index?: number;
  isOpen: boolean;
  origin: string;
  style: string;
}

class Portal extends PureComponent<React.PropsWithChildren<PortalProps>, {}> {
  node: HTMLElement;

  constructor(props: React.PropsWithChildren<PortalProps>) {
    super(props);
    const { index = 0, origin = 'query', style } = props;
    this.node = document.createElement('div');
    this.node.setAttribute('style', style);
    this.node.classList.add(`slate-typeahead`, `slate-typeahead-${origin}-${index}`);
    document.body.appendChild(this.node);
  }

  componentWillUnmount() {
    document.body.removeChild(this.node);
  }

  render() {
    if (this.props.isOpen) {
      this.node.setAttribute('style', this.props.style);
      this.node.classList.add(`slate-typeahead--open`);
      return ReactDOM.createPortal(this.props.children, this.node);
    } else {
      this.node.classList.remove(`slate-typeahead--open`);
    }

    return null;
  }
}
