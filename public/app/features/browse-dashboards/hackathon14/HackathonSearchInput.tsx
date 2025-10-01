import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2, Button, Icon, Dropdown, Text } from '@grafana/ui';

import { FilterTag } from './FilterTag';

interface HackathonSearchInputProps {
  onSearchChange?: (value: string) => void;
  placeholder?: string;
}

export const HackathonSearchInput = ({
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
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

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

  const renderMoreFiltersDropdown = () => (
    <div className={styles.moreFiltersDropdown}>
      <Text variant="h5">Advanced filters</Text>
      <Text variant="bodySmall" color="secondary">
        Tweak additional filters to refine your dashboard results.
      </Text>

      <div className={styles.moreFiltersSection}>
        <Text variant="bodyStrong">Resource type</Text>
        <div className={styles.moreFiltersRow}>
          <Button size="sm" variant="secondary">Dashboards</Button>
          <Button size="sm" variant="secondary">Folders</Button>
          <Button size="sm" variant="secondary">Dashboards + Folders</Button>
        </div>
      </div>

      <div className={styles.moreFiltersSection}>
        <Text variant="bodyStrong">Sort by</Text>
        <div className={styles.moreFiltersRow}>
          <Button size="sm" variant="secondary">Most popular</Button>
          <Button size="sm" variant="secondary">Recently updated</Button>
          <Button size="sm" variant="secondary">Recently visited</Button>
        </div>
      </div>

      <div className={styles.moreFiltersSection}>
        <Text variant="bodyStrong">Time range</Text>
        <div className={styles.moreFiltersRow}>
          <Button size="sm" variant="secondary">Last 7 days</Button>
          <Button size="sm" variant="secondary">Last 30 days</Button>
          <Button size="sm" variant="secondary">All time</Button>
        </div>
      </div>

      <div className={styles.aiDiscoveryWrapper}>
        <Text variant="bodyStrong" className={styles.aiDiscoveryTitle}>
          AI-powered discovery:
        </Text>
        <div className={styles.aiDiscoveryButtons}>
          {aiDiscoveryButtons.map((label) => (
            <Button
              key={label}
              variant="primary"
              size="sm"
              className={styles.aiDiscoveryButton}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const aiDiscoveryButtons = [
    '💡 Recommend dashboards for me',
    '🚀 What should I explore?',
    '📊 Discover new insights',
    '✨ Discover more',
  ];

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
            variant={activeFilters.starred ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('starred')}
            className={styles.filterButton}
          >
            <Icon name="star" />
            Starred
          </Button>

          <Button
            variant={activeFilters.ownedByMe ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('ownedByMe')}
            className={styles.filterButton}
          >
            <Icon name="user" />
            Owned by me
          </Button>

          <FilterTag />

          <Dropdown
            overlay={renderMoreFiltersDropdown}
            placement="bottom-start"
            isOpen={isMoreFiltersOpen}
            onOpenChange={(open) => setIsMoreFiltersOpen(open)}
          >
            <Button
              variant={isMoreFiltersOpen ? 'primary' : 'secondary'}
              size="sm"
              className={styles.filterButton}
              icon="filter"
              onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
            >
              More filters
            </Button>
          </Dropdown>
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

  moreFiltersDropdown: css({
    padding: theme.spacing(3),
    width: '640px',
    maxWidth: '640px',
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    boxShadow: `0 12px 28px rgba(112, 76, 182, 0.28)`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    backgroundImage: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), transparent 35%, rgba(236, 72, 153, 0.12))',
  }),

  moreFiltersSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),

  moreFiltersRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),

  aiDiscoveryWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(236, 72, 153, 0.1))',
    border: `1px solid rgba(99, 102, 241, 0.35)`,
    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.18)',
  }),

  aiDiscoveryTitle: css({
    color: theme.colors.text.secondary,
  }),

  aiDiscoveryButtons: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),

  aiDiscoveryButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    borderRadius: theme.shape.radius.pill,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    border: 'none',
    boxShadow: '0 6px 14px rgba(59, 130, 246, 0.28)',

    '&:hover': {
      background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
      transform: 'translateY(-2px)',
      boxShadow: '0 10px 24px rgba(79, 70, 229, 0.35)',
    },
  }),
});
