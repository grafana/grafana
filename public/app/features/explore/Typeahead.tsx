import React, { createRef, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import { FixedSizeList } from 'react-window';

import { Themeable, withTheme } from '@grafana/ui';

import { CompletionItem, CompletionItemKind, CompletionItemGroup } from 'app/types/explore';
import { TypeaheadItem } from './TypeaheadItem';
import { TypeaheadInfo } from './TypeaheadInfo';
import { flattenGroupItems, calculateLongestLabel, calculateListSizes } from './utils/typeahead';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);

interface Props extends Themeable {
  origin: string;
  groupedItems: CompletionItemGroup[];
  prefix?: string;
  menuRef?: (el: Typeahead) => void;
  onSelectSuggestion?: (suggestion: CompletionItem) => void;
  isOpen?: boolean;
}

interface State {
  allItems: CompletionItem[];
  listWidth: number;
  listHeight: number;
  itemHeight: number;
  hoveredItem: number;
  typeaheadIndex: number;
}

export class Typeahead extends React.PureComponent<Props, State> {
  listRef = createRef<FixedSizeList>();

  constructor(props: Props) {
    super(props);

    const allItems = flattenGroupItems(props.groupedItems);
    const longestLabel = calculateLongestLabel(allItems);
    const { listWidth, listHeight, itemHeight } = calculateListSizes(props.theme, allItems, longestLabel);
    this.state = { listWidth, listHeight, itemHeight, hoveredItem: null, typeaheadIndex: 1, allItems };
  }

  componentDidMount = () => {
    this.props.menuRef(this);
  };

  componentDidUpdate = (prevProps: Readonly<Props>, prevState: Readonly<State>) => {
    if (prevState.typeaheadIndex !== this.state.typeaheadIndex && this.listRef && this.listRef.current) {
      if (this.state.typeaheadIndex === 1) {
        this.listRef.current.scrollToItem(0); // special case for handling the first group label
        return;
      }
      this.listRef.current.scrollToItem(this.state.typeaheadIndex);
    }

    if (_.isEqual(prevProps.groupedItems, this.props.groupedItems) === false) {
      const allItems = flattenGroupItems(this.props.groupedItems);
      const longestLabel = calculateLongestLabel(allItems);
      const { listWidth, listHeight, itemHeight } = calculateListSizes(this.props.theme, allItems, longestLabel);
      this.setState({ listWidth, listHeight, itemHeight, allItems });
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
      event.preventDefault();
      let newTypeaheadIndex = modulo(this.state.typeaheadIndex + moveAmount, itemCount);

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
    this.props.onSelectSuggestion(this.state.allItems[this.state.typeaheadIndex]);
  };

  get menuPosition(): CSSProperties {
    // Exit for unit tests
    if (!window.getSelection) {
      return {};
    }

    const selection = window.getSelection();
    const node = selection.anchorNode;

    // Align menu overlay to editor node
    if (node) {
      // Read from DOM
      const rect = node.parentElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      return {
        top: `${rect.top + scrollY + rect.height + 4}px`,
        left: `${rect.left + scrollX - 2}px`,
      };
    }

    return {};
  }

  render() {
    const { prefix, theme, isOpen, origin } = this.props;
    const { allItems, listWidth, listHeight, itemHeight, hoveredItem, typeaheadIndex } = this.state;

    const showDocumentation = hoveredItem || typeaheadIndex;

    return (
      <Portal origin={origin} isOpen={isOpen}>
        <ul className="typeahead" style={this.menuPosition}>
          <FixedSizeList
            ref={this.listRef}
            itemCount={allItems.length}
            itemSize={itemHeight}
            itemKey={index => {
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
                  onClickItem={() => this.props.onSelectSuggestion(item)}
                  isSelected={allItems[typeaheadIndex] === item}
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

        {showDocumentation && (
          <TypeaheadInfo
            width={listWidth}
            height={listHeight}
            theme={theme}
            item={allItems[hoveredItem ? hoveredItem : typeaheadIndex]}
          />
        )}
      </Portal>
    );
  }
}

export const TypeaheadWithTheme = withTheme(Typeahead);

interface PortalProps {
  index?: number;
  isOpen: boolean;
  origin: string;
}

class Portal extends React.PureComponent<PortalProps, {}> {
  node: HTMLElement;

  constructor(props: PortalProps) {
    super(props);
    const { index = 0, origin = 'query' } = props;
    this.node = document.createElement('div');
    this.node.classList.add(`slate-typeahead`, `slate-typeahead-${origin}-${index}`);
    document.body.appendChild(this.node);
  }

  componentWillUnmount() {
    document.body.removeChild(this.node);
  }

  render() {
    if (this.props.isOpen) {
      return ReactDOM.createPortal(this.props.children, this.node);
    }

    return null;
  }
}
