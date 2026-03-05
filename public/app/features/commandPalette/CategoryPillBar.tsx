import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DynamicProviderCategory } from './CommandPaletteDynamicRegistry';

interface CategoryPillBarProps {
  categories: DynamicProviderCategory[];
  selectedCategory: string | null;
  onSelectCategory: (label: string) => void;
}

export function CategoryPillBar({ categories, selectedCategory, onSelectCategory }: CategoryPillBarProps) {
  const styles = useStyles2(getStyles);

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {categories.map((cat, index) => {
        const shortcutLabel = `⌘${index + 1}`;
        const isSelected = selectedCategory === cat.label;

        return (
          <button
            key={cat.label}
            className={isSelected ? styles.pillActive : styles.pill}
            onClick={() => onSelectCategory(cat.label)}
            type="button"
          >
            <span className={styles.shortcut}>{shortcutLabel}</span>
            <span>{cat.label}</span>
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
      background: 'rgba(0, 0, 0, 0.40)',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      '&:hover': {
        background: 'rgba(0, 0, 0, 0.55)',
      },
    }),
    shortcut: css({
      color: 'rgba(204, 204, 220, 0.4)',
      marginRight: theme.spacing(0.5),
    }),
  };
}
