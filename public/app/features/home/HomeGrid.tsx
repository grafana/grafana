import { css } from '@emotion/css';
import { type HTMLAttributes, type ReactNode } from 'react';

import { type GrafanaTheme2, type ThemeSpacingTokens } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface HomeGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
  children: ReactNode;
  /**
   * Most columns to lay out: two from the page's `md` breakpoint, three from `xl`; one below `md`.
   * Below `xl` a third of the page is under 344px, too narrow for a card's stat and sparkline row.
   */
  columns: 1 | 2 | 3;
  gap: ThemeSpacingTokens;
}

/**
 * Card grid whose column count follows the page content column through the `page` query container
 * (Page.tsx) at the theme breakpoints. `Grid columns={{ md: 2 }}` keys off the viewport, so the
 * assistant sidebar and the docked mega menu — which halve the page without resizing the window —
 * squeezed cards into columns they could not fit.
 */
export function HomeGrid({ children, columns, gap, ...rest }: HomeGridProps) {
  const styles = useStyles2(getStyles, columns, gap);

  return (
    <div {...rest} className={styles.grid}>
      {children}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, columns: 1 | 2 | 3, gap: ThemeSpacingTokens) => ({
  grid: css([
    {
      display: 'grid',
      gap: theme.spacing(gap),
      // minmax(0, 1fr): a card's unbreakable content must never widen its column.
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
    columns >= 2 && {
      [theme.breakpoints.container.up('md', 'page')]: {
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      },
    },
    columns === 3 && {
      [theme.breakpoints.container.up('xl', 'page')]: {
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      },
    },
  ]),
});
