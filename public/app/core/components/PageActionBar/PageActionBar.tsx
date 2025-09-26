import { css } from '@emotion/css';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { LinkButton, FilterInput, InlineField, Checkbox, useStyles2 } from '@grafana/ui';

import { SortPicker } from '../Select/SortPicker';

export type FilterCheckbox = {
  onChange: (value: boolean) => void;
  value: boolean;
  label?: string;
};

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
  filterCheckbox?: FilterCheckbox;
}

export default function PageActionBar({
  searchQuery,
  linkButton,
  setSearchQuery,
  target,
  placeholder = 'Search by name or type',
  sortPicker,
  filterCheckbox,
}: Props) {
  const styles = useStyles2(getStyles);
  const linkProps: Omit<Parameters<typeof LinkButton>[0], 'children'> = {
    href: linkButton?.href,
    disabled: linkButton?.disabled,
  };

  if (target) {
    linkProps.target = target;
  }

  return (
    <div className={styles.container}>
      <InlineField grow>
        <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={placeholder} />
      </InlineField>
      {filterCheckbox && (
        <Checkbox
          label={filterCheckbox.label}
          value={filterCheckbox.value}
          onChange={(event) => filterCheckbox.onChange(event.currentTarget.checked)}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
  };
};
