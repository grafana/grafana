import React from 'react';
// @ts-ignore
import _ from 'lodash';
import { default as calculateSize } from 'calculate-size';
import { Themeable, withTheme } from '@grafana/ui';
import { FixedSizeList } from 'react-window';

import { CompletionItem } from 'app/types/explore';
import { TypeaheadItem } from './TypeaheadItem';

interface Props extends Themeable {
  items: CompletionItem[];
  label: string;
  onClickItem: (suggestion: CompletionItem) => void;
  selected: CompletionItem;
  prefix?: string;
  scrollIndex: number;
}

interface State {
  longestLabelWidth: number;
}

export class TypeaheadGroup extends React.PureComponent<Props, State> {
  listRef: any = React.createRef();

  constructor(props: Props) {
    super(props);

    const longestLabelWidth = this.calculateWidth(props);
    this.state = { longestLabelWidth };
  }

  componentDidUpdate(prevProps: Props) {
    const { scrollIndex, items } = this.props;

    if (prevProps.scrollIndex !== scrollIndex) {
      if (this.listRef && this.listRef.current) {
        this.listRef.current.scrollToItem(scrollIndex);
      }
    }

    if (_.isEqual(items, prevProps.items) === false) {
      const longestLabelWidth = this.calculateWidth(this.props);
      this.setState({ longestLabelWidth });
    }
  }

  calculateWidth = (props: Props) => {
    const { items, theme } = props;

    const longestLabel = items.reduce((longest, current) => {
      return longest.length < current.label.length ? current.label : longest;
    }, '');

    const size = calculateSize(longestLabel, {
      font: props.theme.typography.fontFamily.monospace,
      fontSize: props.theme.typography.size.sm,
    });

    const padding = parseInt(theme.spacing.sm, 10) + parseInt(theme.spacing.md, 10);
    const longestLabelWidth = Math.max(size.width + padding, 200);

    return longestLabelWidth;
  };

  render() {
    const { items, label, selected, onClickItem, prefix } = this.props;
    const { longestLabelWidth } = this.state;

    return (
      <li className="typeahead-group">
        <div className="typeahead-group__title">{label}</div>
        <ul className="typeahead-group__list">
          <FixedSizeList
            ref={this.listRef}
            itemCount={items.length}
            itemSize={30}
            itemKey={index => {
              const item = items && items[index];
              return item ? item.label : null;
            }}
            width={longestLabelWidth}
            height={300}
          >
            {({ index, style }) => {
              const item = items && items[index];
              if (!item) {
                return null;
              }

              return (
                <TypeaheadItem
                  onClickItem={onClickItem}
                  isSelected={selected === item}
                  item={item}
                  prefix={prefix}
                  style={style}
                />
              );
            }}
          </FixedSizeList>
        </ul>
      </li>
    );
  }
}

export const TypeaheadGroupWithTheme = withTheme(TypeaheadGroup);
