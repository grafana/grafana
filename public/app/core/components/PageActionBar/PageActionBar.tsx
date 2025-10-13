import { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { LinkButton, FilterInput, InlineField } from '@grafana/ui';

import { SortPicker } from '../Select/SortPicker';

export interface Props {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  linkButton?: { href: string; title: string; disabled?: boolean };
  target?: string;
  placeholder?: string;
  sortPicker?: {
    onChange: (sortValue: SelectableValue) => void;
    value?: string;
    getSortOptions?: () => Promise<SelectableValue[]>;
  };
}

export default class PageActionBar extends PureComponent<Props> {
  render() {
    const {
      searchQuery,
      linkButton,
      setSearchQuery,
      target,
      placeholder = 'Search by name or type',
      sortPicker,
    } = this.props;
    const linkProps: Parameters<typeof LinkButton>[0] = { href: linkButton?.href, disabled: linkButton?.disabled };

    if (target) {
      linkProps.target = target;
    }

    return (
      <div className="page-action-bar">
        <InlineField grow>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
        </InlineField>
        {sortPicker && (
          <SortPicker
            onChange={sortPicker.onChange}
            value={sortPicker.value}
            getSortOptions={sortPicker.getSortOptions}
          />
        )}
        {linkButton && <LinkButton {...linkProps}>{linkButton.title}</LinkButton>}
      </div>
    );
  }
}
