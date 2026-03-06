import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CommandPaletteDynamicFacet } from './facetTypes';

interface FacetPillBarProps {
  facets: CommandPaletteDynamicFacet[];
  activeFacets: Record<string, string>;
  activeFacetLabels: Record<string, string>;
  onActivateFacet: (facetId: string) => void;
}

export function FacetPillBar({ facets, activeFacets, activeFacetLabels, onActivateFacet }: FacetPillBarProps) {
  const styles = useStyles2(getStyles);

  if (facets.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {facets.map((facet) => {
        const isActive = facet.id in activeFacets;
        const shortcutLabel = facet.shortcutKey ? `⌘${facet.shortcutKey}` : '';

        return (
          <button
            key={facet.id}
            className={isActive ? styles.pillActive : styles.pill}
            onClick={() => onActivateFacet(facet.id)}
            type="button"
          >
            {shortcutLabel && <span className={isActive ? styles.shortcutActive : styles.shortcut}>{shortcutLabel}</span>}
            <span>{facet.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexWrap: 'wrap',
    }),
    pill: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0.375, 0.75),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: 'rgba(0, 0, 0, 0.40)',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      '&:hover': {
        background: 'rgba(0, 0, 0, 0.55)',
        color: theme.colors.text.primary,
      },
    }),
    pillActive: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0.375, 0.75),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: '#CCCCDC',
      color: theme.colors.background.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      '&:hover': {
        background: '#b8b8cc',
      },
    }),
    shortcut: css({
      color: 'rgba(204, 204, 220, 0.4)',
      marginRight: theme.spacing(0.5),
    }),
    shortcutActive: css({
      opacity: 0.5,
      marginRight: theme.spacing(0.5),
    }),
  };
}
