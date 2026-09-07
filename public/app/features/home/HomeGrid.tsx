import { css } from '@emotion/css';
import { type HTMLAttributes, type ReactNode } from 'react';

import { type GrafanaTheme2, type ThemeSpacingTokens } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

/**
 * Narrowest column (px) an overview card (SolutionCard, Guide) lays out without clipping: 32px of
 * card padding plus its ~250px CTA label or its stat + sparkline row.
 */
export const HOME_CARD_MIN_WIDTH = 300;

/**
 * Narrowest column (px) a homepage section lays out without clipping: the alerts header (title +
 * team combobox), the dashboard tab bars, and the recommendation cards inside their 32px padding.
 */
export const HOME_SECTION_MIN_WIDTH = 352;

interface HomeGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
  children: ReactNode;
  /** Most columns to lay out; fewer render whenever the grid is too narrow to give each one `minColumnWidth`. */
  columns: 1 | 2 | 3;
  minColumnWidth: number;
  gap: ThemeSpacingTokens;
}

/**
 * Card grid whose column count follows its own width. `Grid columns={{ md: 2 }}` keys off the
 * viewport, so the assistant sidebar and the docked mega menu — which halve the page without
 * resizing the window — squeezed cards into columns they could not fit.
 */
export function HomeGrid({ children, columns, minColumnWidth, gap, ...rest }: HomeGridProps) {
  const styles = useStyles2(getStyles, columns, minColumnWidth, gap);

  return (
    // A container query cannot style the container itself, so the query container wraps the grid.
    <div className={styles.container}>
      <div {...rest} className={styles.grid}>
        {children}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, columns: 1 | 2 | 3, minColumnWidth: number, gap: ThemeSpacingTokens) => {
  const gapPx = gap * theme.spacing.gridSize;
  const counts = Array.from({ length: columns - 1 }, (_, i) => i + 2);

  return {
    container: css({
      containerType: 'inline-size',
    }),
    grid: css([
      {
        display: 'grid',
        gap: theme.spacing(gap),
        // minmax(0, 1fr): a card's unbreakable content must never widen its column.
        gridTemplateColumns: 'minmax(0, 1fr)',
      },
      ...counts.map((count) => ({
        [theme.breakpoints.container.up(count * minColumnWidth + (count - 1) * gapPx)]: {
          gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
        },
      })),
    ]),
  };
};
