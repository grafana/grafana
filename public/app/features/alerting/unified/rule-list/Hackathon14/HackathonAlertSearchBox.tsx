import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, FilterInput, Icon, useStyles2 } from '@grafana/ui';

import { PopupCard } from '../../components/HoverCard';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { FilterOptions } from '../filter/RulesFilter.v2';
import { emptyAdvancedFilters, formAdvancedFiltersToRuleFilter } from '../filter/utils';

interface HackathonSearchInputProps {
  onSearchChange?: (value: string) => void;
  onFilterChange?: (filters: { firing: boolean; ownedByMe: boolean }) => void;
  placeholder?: string;
}

export const HackathonAlertSearchInput = ({
  onSearchChange,
  onFilterChange,
  placeholder = t('alerting.hackathon.search.placeholder', 'Search for alert rules'),
}: HackathonSearchInputProps) => {
  const styles = useStyles2(getStyles);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    firing: false,
    ownedByMe: false,
    moreFilters: false,
  });

  // Advanced filters popup state (reuse same component as non-SparkJoy view)
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const { updateFilters, setSearchQuery: setGlobalSearch, hasActiveFilters } = useRulesFilter();

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const toggleFilter = (filterKey: 'firing' | 'ownedByMe' | 'moreFilters') => {
    // Quick filters are mutually exclusive (except the popup filters)
    const newFilters = {
      firing: filterKey === 'firing' ? !activeFilters.firing : false,
      ownedByMe: filterKey === 'ownedByMe' ? !activeFilters.ownedByMe : false,
      moreFilters: filterKey === 'moreFilters' ? !activeFilters.moreFilters : activeFilters.moreFilters,
    };
    setActiveFilters(newFilters);

    // Notify parent of filter changes (excluding moreFilters which is UI-only)
    onFilterChange?.({
      firing: newFilters.firing,
      ownedByMe: newFilters.ownedByMe,
    });

    // Update global filters for SparkJoy page when quick filters are toggled
    if (filterKey !== 'moreFilters') {
      if (filterKey === 'firing') {
        const next = newFilters.firing ? 'state:alerting' : '';
        setGlobalSearch(next || undefined);
      }
      if (filterKey === 'ownedByMe') {
        const next = newFilters.ownedByMe ? 'owner:me' : '';
        setGlobalSearch(next || undefined);
      }
    }
  };

  const clearAllFilters = () => {
    setActiveFilters({ firing: false, ownedByMe: false, moreFilters: false });
    setSearchValue('');
    onSearchChange?.('');
    onFilterChange?.({ firing: false, ownedByMe: false });
    updateFilters(formAdvancedFiltersToRuleFilter(emptyAdvancedFilters));
    setGlobalSearch(undefined);
    setIsPopupOpen(false);
  };

  return (
    <div className={styles.container}>
      {/* Search Input */}
      <div className={styles.searchContainer}>
        <div className={styles.searchRow}>
          <FilterInput
            placeholder={placeholder}
            value={searchValue}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
          {(hasActiveFilters || activeFilters.firing || activeFilters.ownedByMe || searchValue) && (
            <Button variant="secondary" size="sm" onClick={clearAllFilters}>
              <Trans i18nKey="alerting.hackathon.clear-filters">Clear filters</Trans>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className={styles.filtersContainer}>
        <div className={styles.filtersRow}>
          <span className={styles.lookingForText}>
            <Trans i18nKey="alerting.hackathon.im-looking-for">I&apos;m looking for:</Trans>
          </span>

          <Button
            variant={activeFilters.ownedByMe ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('ownedByMe')}
            className={styles.filterButton}
          >
            <Icon name="user" style={{ marginRight: '4px' }} />
            <Trans i18nKey="alerting.hackathon.created-by-me">Created by me</Trans>
          </Button>

          <Button
            variant={activeFilters.firing ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => toggleFilter('firing')}
            className={styles.filterButton}
          >
            <Icon name="fire" style={{ marginRight: '4px' }} />
            <Trans i18nKey="alerting.hackathon.firing">Firing</Trans>
          </Button>

          <PopupCard
            showOn="click"
            placement="auto"
            disableBlur={true}
            isOpen={isPopupOpen}
            onClose={() => setIsPopupOpen(false)}
            onToggle={() => setIsPopupOpen((s) => !s)}
            content={
              <div ref={popupRef} className={styles.popupContent}>
                <FilterOptions
                  onSubmit={(values) => {
                    updateFilters(formAdvancedFiltersToRuleFilter(values));
                    setIsPopupOpen(false);
                  }}
                  onClear={() => {
                    updateFilters(formAdvancedFiltersToRuleFilter(emptyAdvancedFilters));
                    setGlobalSearch(undefined);
                    setIsPopupOpen(false);
                  }}
                  pluginsFilterEnabled={false}
                />
              </div>
            }
          >
            <Button
              variant={activeFilters.moreFilters ? 'primary' : 'secondary'}
              size="sm"
              className={styles.filterButton}
            >
              <Icon name="filter" style={{ marginRight: '4px' }} />
              <Trans i18nKey="alerting.hackathon.filters">More filters</Trans>
            </Button>
          </PopupCard>
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
  searchRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    maxWidth: '800px',
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
  popupContent: css({
    maxWidth: '720px',
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
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'all 0.3s ease',
    },
    border: '2px solid transparent',

    '& svg': {
      width: '14px',
      height: '14px',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'filter 0.3s ease',
      },
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
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'opacity 0.3s ease',
      },
      zIndex: -1,
    },

    '&:hover': {
      [theme.transitions.handleMotion('no-preference')]: {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(255, 120, 10, 0.1)',
      },

      '&::before': {
        opacity: 0.3,
      },

      '& svg': {
        [theme.transitions.handleMotion('no-preference')]: {
          filter: 'drop-shadow(0 0 6px rgba(255, 120, 10, 0.4))',
        },
      },
    },

    // Active state with stronger gradient
    '&[aria-pressed="true"], &[data-active="true"]': {
      '&::before': {
        opacity: 0.5,
      },

      '& svg': {
        [theme.transitions.handleMotion('no-preference')]: {
          filter: 'drop-shadow(0 0 8px rgba(255, 120, 10, 0.6))',
        },
      },
    },
  }),
});
