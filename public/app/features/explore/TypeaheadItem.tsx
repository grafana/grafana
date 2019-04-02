import React from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';

import { CompletionItem } from 'app/types/explore';

interface Props {
  isSelected: boolean;
  item: CompletionItem;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  style: any;
}

export class TypeaheadItem extends React.PureComponent<Props> {
  onClick = () => {
    this.props.onClickItem(this.props.item);
  };

  render() {
    const { isSelected, item, prefix, style } = this.props;
    const className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
    const label = item.label || '';
    return (
      <li className={className} onClick={this.onClick} style={style}>
        <Highlighter textToHighlight={label} searchWords={[prefix]} highlightClassName="typeahead-match" />
        {item.documentation && isSelected ? <div className="typeahead-item-hint">{item.documentation}</div> : null}
      </li>
    );
  }
}
