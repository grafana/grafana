import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterInput, Icon, useStyles2 } from '@grafana/ui';
import { FilterTag } from 'app/features/browse-dashboards/hackathon14/FilterTag';

import { FilterButton } from './FilterButton';

interface HackathonSearchInputProps {
  onSearchChange?: (value: string) => void;
  placeholder?: string;
}

export const HackathonAlertSearchInput = ({
  onSearchChange,
  placeholder = 'Search for dashboards and folders',
}: HackathonSearchInputProps) => {
  const styles = useStyles2(getStyles);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    starred: false,
    ownedByMe: false,
    filterByTag: false,
    moreFilters: false,
  });

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const toggleFilter = (filterKey: keyof typeof activeFilters) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterKey]: !prev[filterKey],
    }));
  };

  return (
    <div className={styles.container}>
      {/* Search Input */}
      <div className={styles.searchContainer}>
        <FilterInput
          placeholder={placeholder}
          value={searchValue}
          onChange={handleSearchChange}
          className={styles.searchInput}
        />
      </div>

      {/* Filter Buttons */}
      <div className={styles.filtersContainer}>
        <div className={styles.filtersRow}>
          <span className={styles.lookingForText}>I'm looking for:</span>

          <Button
            variant={activeFilters.ownedByMe ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('ownedByMe')}
            className={styles.filterButton}
          >
            <Icon name="user" style={{ marginRight: '4px' }} />
            Created by me
          </Button>

          <Button
            variant={activeFilters.ownedByMe ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('ownedByMe')}
            className={styles.filterButton}
          >
            <Icon name="fire" style={{ marginRight: '4px' }} />
            Firing
          </Button>

          <Button
            variant={activeFilters.moreFilters ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('moreFilters')}
            className={styles.filterButton}
          >
            <Icon name="filter" style={{ marginRight: '4px' }} />
            Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
    padding: theme.spacing(2),
  }),

  searchContainer: css({
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  }),

  searchInput: css({
    width: '100%',
    maxWidth: '800px',
    height: '40px',

    // Custom styling to match the image
    '& input': {
      fontSize: theme.typography.size.md,
      padding: theme.spacing(1.5, 2),
      border: `2px solid ${theme.colors.primary.main}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
      color: theme.colors.text.primary,

      '&:focus': {
        borderColor: theme.colors.primary.main,
        boxShadow: `0 0 0 2px ${theme.colors.primary.main}25`,
      },

      '&::placeholder': {
        color: theme.colors.text.secondary,
        opacity: 0.8,
      },
    },
  }),

  filtersContainer: css({
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  }),

  filtersRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    justifyContent: 'center',

    [theme.breakpoints.down('md')]: {
      justifyContent: 'flex-start',
    },
  }),

  lookingForText: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),

  filterButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: theme.spacing(4),
    position: 'relative',
    transition: 'all 0.3s ease',
    border: '2px solid transparent',

    '& svg': {
      width: '14px',
      height: '14px',
      transition: 'filter 0.3s ease',
    },

    // Subtle gradient border on hover
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -2,
      left: -2,
      right: -2,
      bottom: -2,
      borderRadius: theme.shape.radius.default,
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },

    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(255, 120, 10, 0.1)',

      '&::before': {
        opacity: 0.3,
      },

      '& svg': {
        filter: 'drop-shadow(0 0 6px rgba(255, 120, 10, 0.4))',
      },
    },

    // Active state with stronger gradient
    '&[aria-pressed="true"], &[data-active="true"]': {
      '&::before': {
        opacity: 0.5,
      },

      '& svg': {
        filter: 'drop-shadow(0 0 8px rgba(255, 120, 10, 0.6))',
      },
    },
  }),
});
