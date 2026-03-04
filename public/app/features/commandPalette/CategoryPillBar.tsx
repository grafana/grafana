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
      gap: theme.spacing(0.75),
      padding: theme.spacing(0.75, 2),
      borderBottom: '1px solid rgba(83, 83, 85, 0.5)',
      flexWrap: 'wrap',
    }),
    pill: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      background: 'rgba(0, 0, 0, 0.40)',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
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
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      background: 'rgba(0, 0, 0, 0.40)',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      '&:hover': {
        background: 'rgba(0, 0, 0, 0.55)',
      },
    }),
    shortcut: css({
      fontSize: '10px',
      fontWeight: theme.typography.fontWeightMedium,
      padding: '0 4px',
      lineHeight: '18px',
    }),
  };
}
