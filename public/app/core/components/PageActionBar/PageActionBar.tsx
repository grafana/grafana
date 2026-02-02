import { css } from '@emotion/css';
import { PureComponent } from 'react';
// BMC Code : Accessibility Change starts here.

import { SelectableValue } from '@grafana/data';
import { LinkButton, FilterInput, InlineField } from '@grafana/ui';
// BMC Code : Accessibility Change ends here.
import { t } from 'app/core/internationalization';

import { SortPicker } from '../Select/SortPicker';
// BMC Code : Accessibility Change starts here.
const getStyles = () => {
  return {
    hiddenLabel: css({
      border: '0',
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: '0',
      position: 'absolute',
      width: '1px',
    }),
  };
};
// BMC Code : Accessibility Change ends here.
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
      // BMC Change: Next line
      placeholder = t('bmcgrafana.search-inputs.name-type', 'Search by name or type'),
      sortPicker,
    } = this.props;
    const linkProps: Parameters<typeof LinkButton>[0] = { href: linkButton?.href, disabled: linkButton?.disabled };
    // BMC Change: Next line
    const styles = getStyles();

    if (target) {
      linkProps.target = target;
    }

    return (
      <div className="page-action-bar">
        {/* // BMC Code : Accessibility Change starts here. */}
        <label htmlFor="playlist-hidden" className={styles.hiddenLabel}>
          {placeholder}
        </label>
        <InlineField grow>
          <FilterInput id="playlist-hidden" value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
        </InlineField>
        {/* //BMC code Accessibility change ends here */}
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
