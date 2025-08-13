import { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { LinkButton, FilterInput, InlineField, Checkbox } from '@grafana/ui';
import { FavoritesCheckbox } from 'app/features/datasources/components/DataSourcesList';

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
  favoritesCheckbox?: FavoritesCheckbox;
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
      favoritesCheckbox,
    } = this.props;
    const linkProps: Omit<Parameters<typeof LinkButton>[0], 'children'> = {
      href: linkButton?.href,
      disabled: linkButton?.disabled,
    };

    if (target) {
      linkProps.target = target;
    }

    return (
      <div className="page-action-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <InlineField grow>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
        </InlineField>
        {favoritesCheckbox && (
          <Checkbox
            label={favoritesCheckbox.label}
            value={favoritesCheckbox.value}
            onChange={(event) => favoritesCheckbox.onChange(event.currentTarget.checked)}
          />
        )}
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
