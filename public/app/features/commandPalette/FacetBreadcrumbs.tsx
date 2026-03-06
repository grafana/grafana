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
  selectedEntity?: {
    name: string;
    icon?: React.ReactNode;
  };
}

export function FacetBreadcrumbs({
  category,
  categoryIcon,
  facets,
  activeFacets,
  activeFacetLabels,
  selectingFacetId,
  selectedEntity,
}: FacetBreadcrumbsProps) {
  const styles = useStyles2(getStyles);

  const selectingFacet = selectingFacetId ? facets.find((f) => f.id === selectingFacetId) : null;

  return (
    <span className={styles.container}>
      <span className={styles.badge}>
        {categoryIcon && (
          <span className={styles.badgeIcon}>
            <Icon name={categoryIcon} />
          </span>
        )}
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
            <span className={styles.separator}>/</span>
            <span className={styles.badge}>
              {facet.label}<span className={styles.badgeValue}>: {label}</span>
            </span>
          </React.Fragment>
        );
      })}
      {selectingFacet && (
        <>
          <span className={styles.separator}>/</span>
          <span className={styles.badge}>{selectingFacet.label}</span>
        </>
      )}
      {selectedEntity && (
        <>
          <span className={styles.separator}>/</span>
          <span className={styles.entityBadge}>
            {selectedEntity.icon && <span className={styles.badgeIcon}>{selectedEntity.icon}</span>}
            {selectedEntity.name}
          </span>
        </>
      )}
      {!selectingFacet && !selectedEntity && <span className={styles.separator}>/</span>}
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
      gap: theme.spacing(1),
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
    badge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: '18px',
      fontWeight: theme.typography.fontWeightRegular,
      color: '#ccccdc',
      background: theme.colors.action.selected,
      borderRadius: theme.shape.radius.default,
      padding: '0 6px',
      height: '32px',
      lineHeight: '32px',
      letterSpacing: '-0.045px',
    }),
    badgeValue: css({
      color: theme.colors.text.secondary,
    }),
    entityBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: '18px',
      fontWeight: theme.typography.fontWeightRegular,
      color: theme.colors.text.secondary,
      background: theme.colors.action.selected,
      borderRadius: theme.shape.radius.default,
      padding: '0 6px',
      height: '32px',
      lineHeight: '32px',
      letterSpacing: '-0.045px',
    }),
    badgeIcon: css({
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      '& > svg': {
        width: '20px',
        height: '20px',
      },
    }),
    separator: css({
      color: 'rgba(204, 204, 220, 0.4)',
      fontSize: '18px',
      lineHeight: '24px',
      letterSpacing: '-0.045px',
    }),
  };
}
