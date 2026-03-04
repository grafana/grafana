import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

import { CommandPaletteDynamicFacet } from './facetTypes';

interface FacetBreadcrumbsProps {
  category: string;
  categoryIcon?: IconName;
  facets: CommandPaletteDynamicFacet[];
  activeFacets: Record<string, string>;
  activeFacetLabels: Record<string, string>;
  selectingFacetId: string | null;
}

export function FacetBreadcrumbs({
  category,
  categoryIcon,
  facets,
  activeFacets,
  activeFacetLabels,
  selectingFacetId,
}: FacetBreadcrumbsProps) {
  const styles = useStyles2(getStyles);

  const selectingFacet = selectingFacetId ? facets.find((f) => f.id === selectingFacetId) : null;

  return (
    <span className={styles.container}>
      <span className={styles.category}>
        {categoryIcon && <Icon name={categoryIcon} size="sm" className={styles.categoryIcon} />}
        {category}
      </span>
      {facets.map((facet) => {
        const value = activeFacets[facet.id];
        if (value === undefined) {
          return null;
        }
        const label = activeFacetLabels[facet.id] ?? value;
        return (
          <React.Fragment key={facet.id}>
            <span className={styles.separator}>&nbsp;/&nbsp;</span>
            <span className={styles.facetBadge}>
              {facet.label}: {label}
            </span>
          </React.Fragment>
        );
      })}
      {selectingFacet && (
        <>
          <span className={styles.separator}>&nbsp;/&nbsp;</span>
          <span className={styles.facetLabel}>{selectingFacet.label}</span>
        </>
      )}
      <span className={styles.separator}>&nbsp;/&nbsp;</span>
    </span>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }),
    category: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      background: 'rgba(255, 255, 255, 0.10)',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.75),
      lineHeight: 1.6,
    }),
    categoryIcon: css({
      opacity: 0.7,
    }),
    separator: css({
      color: theme.colors.text.disabled,
      fontSize: theme.typography.body.fontSize,
    }),
    facetBadge: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      background: 'rgba(255, 255, 255, 0.10)',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.75),
      lineHeight: 1.6,
    }),
    facetLabel: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
  };
}
