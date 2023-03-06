import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { LinkButton, FilterInput } from '@grafana/ui';

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
    const linkProps: typeof LinkButton.defaultProps = { href: linkButton?.href, disabled: linkButton?.disabled };

    if (target) {
      linkProps.target = target;
    }

    return (
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
        </div>
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
