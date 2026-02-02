import { css } from '@emotion/css';
import { Dispatch, FC, SetStateAction } from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { HorizontalGroup, RadioButtonGroup, stylesFactory, useTheme } from '@grafana/ui';

import { SearchQuery, SearchLayout } from '../../types';

import { SortPicker, TypePicker } from './SortPicker';

export const layoutOptions = [
  // BMC Code : Accessibility Change (Next 2 lines)
  { label: 'Folder view', value: SearchLayout.Module, icon: 'folder' },
  { label: 'List view', value: SearchLayout.List, icon: 'list-ul' },
];

type onSelectChange = (value: SelectableValue) => void;
interface Props {
  onLayoutChange: Dispatch<SetStateAction<any>>;
  onSortChange: onSelectChange;
  query: SearchQuery;
  hideLayout?: boolean;
  typeOptions: string[];
  onFilterTypeChange: onSelectChange;
}

export const ActionRow: FC<Props> = ({
  onLayoutChange,
  onSortChange,
  query,
  hideLayout,
  typeOptions,
  onFilterTypeChange,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          {!hideLayout ? (
            <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={query.layout} />
          ) : null}
          <SortPicker onChange={onSortChange} value={query.sort?.value} />
          {query.layout === SearchLayout.List ? (
            <TypePicker onChange={onFilterTypeChange} options={typeOptions} value={query.filterType} />
          ) : (
            ''
          )}
        </HorizontalGroup>
      </div>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css`
      display: none;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: ${theme.spacing.lg} 0;
        width: 100%;
      }
    `,
    rowContainer: css`
      margin-right: ${theme.spacing.md};
    `,
    checkboxWrapper: css`
      label {
        line-height: 1.2;
      }
    `,
  };
});
