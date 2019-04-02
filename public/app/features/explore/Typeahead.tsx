import React from 'react';

import { CompletionItem, CompletionItemGroup } from 'app/types/explore';
import { TypeaheadGroup } from './TypeaheadGroup';

interface Props {
  groupedItems: CompletionItemGroup[];
  menuRef: any;
  selectedItem: CompletionItem | null;
  onClickItem: (suggestion: CompletionItem) => void;
  prefix?: string;
  scrollIndex: number;
}
class Typeahead extends React.PureComponent<Props> {
  render() {
    const { groupedItems, menuRef, selectedItem, onClickItem, prefix, scrollIndex } = this.props;
    return (
      <ul className="typeahead" ref={menuRef}>
        {groupedItems.map((g, index) => (
          <TypeaheadGroup
            key={`${index}-${g.label}`}
            onClickItem={onClickItem}
            prefix={prefix}
            selected={selectedItem}
            scrollIndex={scrollIndex}
            {...g}
          />
        ))}
      </ul>
    );
  }
}

export default Typeahead;
