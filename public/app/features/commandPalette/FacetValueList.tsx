import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { CommandPaletteFacetValue } from './facetTypes';

interface FacetValueListProps {
  values: CommandPaletteFacetValue[];
  isLoading: boolean;
  facetLabel: string;
  onSelect: (valueId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  placeholder?: string;
  onBack: () => void;
  breadcrumbs?: React.ReactNode;
}

export function FacetValueList({
  values,
  isLoading,
  facetLabel,
  onSelect,
  searchQuery,
  onSearchQueryChange,
  placeholder,
  onBack,
  breadcrumbs,
}: FacetValueListProps) {
  const styles = useStyles2(getStyles);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset active index when values change
  useEffect(() => {
    setActiveIndex(0);
  }, [values]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex];
      if (activeEl instanceof HTMLElement) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop propagation to prevent kbar's window-level handlers from
      // stealing focus (InternalEvents) or executing actions (KBarResults)
      e.stopPropagation();

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, values.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (values[activeIndex]) {
            onSelect(values[activeIndex].id);
          }
          break;
        case 'Backspace':
          if (searchQuery.length === 0) {
            e.preventDefault();
            onBack();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onBack();
          break;
      }
    },
    [values, activeIndex, onSelect, onBack, searchQuery]
  );

  return (
    <div className={styles.container} onKeyDown={handleKeyDown} role="listbox" aria-label={facetLabel} tabIndex={0}>
      <div className={styles.inputContainer}>
        <button className={styles.backButton} onClick={onBack} aria-label={t('command-palette.facet-values.back', 'Back')} type="button">
          <Icon name="arrow-left" size="md" />
        </button>
        {breadcrumbs}
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={placeholder ?? `Search by ${facetLabel.toLowerCase()}...`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={styles.sectionHeader}>{facetLabel}</div>
      <div className={styles.list} ref={listRef}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <LoadingPlaceholder text={t('command-palette.facet-values.loading', 'Loading...')} />
          </div>
        ) : values.length === 0 ? (
          <div className={styles.emptyState}>
            {t('command-palette.facet-values.empty', 'No options found')}
          </div>
        ) : (
          values.map((value, index) => (
            <div
              key={value.id}
              className={cx(styles.item, index === activeIndex && styles.itemActive)}
              onClick={() => onSelect(value.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(value.id);
                }
              }}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
            >
              {value.icon ?? <Icon name="search" size="sm" className={styles.itemIcon} />}
              <span className={styles.itemLabel}>{value.label}</span>
              {value.count !== undefined && <span className={styles.itemCount}>{value.count}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    inputContainer: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 2),
      borderBottom: '1px solid rgba(83, 83, 85, 0.5)',
      gap: theme.spacing(1),
    }),
    backButton: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      flexShrink: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    input: css({
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
      border: 'none',
      background: 'transparent',
      color: 'rgba(204, 204, 220, 0.65)',
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      fontWeight: 400,
      lineHeight: '24px',
      '&::placeholder': {
        color: 'rgba(204, 204, 220, 0.65)',
      },
    }),
    sectionHeader: css({
      padding: theme.spacing(1, 2, 0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    list: css({
      maxHeight: '400px',
      overflowY: 'auto',
      padding: theme.spacing(0.5, 0),
    }),
    item: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      cursor: 'pointer',
      color: theme.colors.text.primary,
      fontSize: theme.typography.body.fontSize,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    itemActive: css({
      background: theme.colors.action.hover,
    }),
    itemIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    itemLabel: css({
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    itemCount: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      flexShrink: 0,
    }),
    loadingContainer: css({
      padding: theme.spacing(2),
      display: 'flex',
      justifyContent: 'center',
    }),
    emptyState: css({
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
    }),
  };
}
