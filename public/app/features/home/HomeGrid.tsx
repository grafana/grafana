import { css } from '@emotion/css';
import { type CSSObject } from '@emotion/react';
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

/**
 * Styles that apply while a HomeGrid of `minColumnWidth`-wide columns with `gap` between them lays
 * out at least `count` columns. Evaluated against the `page` query container (Page.tsx) rather than
 * the grid itself, so the grid must span the page content column: the page is wider than that
 * column by pageInner's horizontal padding — theme.spacing(2) per side, theme.spacing(4) from the
 * md viewport breakpoint — and the threshold is offset accordingly in each regime.
 */
export function homeGridColumnsUp(
  theme: GrafanaTheme2,
  count: number,
  minColumnWidth: number,
  gap: ThemeSpacingTokens,
  style: CSSObject
): CSSObject {
  const gridWidth = count * minColumnWidth + (count - 1) * gap * theme.spacing.gridSize;
  return {
    [theme.breakpoints.down('md')]: {
      [theme.breakpoints.container.up(gridWidth + 2 * 2 * theme.spacing.gridSize, 'page')]: style,
    },
    [theme.breakpoints.up('md')]: {
      [theme.breakpoints.container.up(gridWidth + 2 * 4 * theme.spacing.gridSize, 'page')]: style,
    },
  };
}

interface HomeGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
  children: ReactNode;
  /** Most columns to lay out; fewer render whenever the grid is too narrow to give each one `minColumnWidth`. */
  columns: 1 | 2 | 3;
  minColumnWidth: number;
  gap: ThemeSpacingTokens;
}

/**
 * Card grid whose column count follows the page content column's width through the `page` query
 * container (see homeGridColumnsUp); render it at that column's full width. `Grid columns={{ md: 2 }}`
 * keys off the viewport, so the assistant sidebar and the docked mega menu — which halve the page
 * without resizing the window — squeezed cards into columns they could not fit.
 */
export function HomeGrid({ children, columns, minColumnWidth, gap, ...rest }: HomeGridProps) {
  const styles = useStyles2(getStyles, columns, minColumnWidth, gap);

  return (
    <div {...rest} className={styles.grid}>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, columns: 1 | 2 | 3, minColumnWidth: number, gap: ThemeSpacingTokens) => ({
  grid: css([
    {
      display: 'grid',
      gap: theme.spacing(gap),
      // minmax(0, 1fr): a card's unbreakable content must never widen its column.
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
    ...Array.from({ length: columns - 1 }, (_, i) => i + 2).map((count) =>
      homeGridColumnsUp(theme, count, minColumnWidth, gap, {
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      })
    ),
  ]),
});
