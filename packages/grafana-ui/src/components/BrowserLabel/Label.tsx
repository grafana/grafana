import { cx, css } from '@emotion/css';
import { forwardRef, HTMLAttributes, useCallback } from 'react';
import * as React from 'react';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { HighlightPart } from '../../types/completion';
import { PartialHighlighter } from '../Typeahead/PartialHighlighter';

type OnLabelClick = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => void;

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  name: string;
  active?: boolean;
  searchTerm?: string;
  value?: string;
  facets?: number;
  title?: string;
  highlightParts?: HighlightPart[];
  onClick?: OnLabelClick;
}

/**
 * @internal
 */
export const Label = forwardRef<HTMLButtonElement, Props>(
  (
    { name, value, hidden, facets, onClick, className, searchTerm, active, style, title, highlightParts, ...rest },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getLabelStyles(theme);
    const searchWords = searchTerm ? [searchTerm] : [];

    const onLabelClick = useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (onClick && !hidden) {
          onClick(name, value, event);
        }
      },
      [onClick, name, hidden, value]
    );

    // Using this component for labels and label values. If value is given use value for display text.
    let text = value || name;
    if (facets) {
      text = `${text} (${facets})`;
    }

    return (
      <button
        key={text}
        ref={ref}
        onClick={onLabelClick}
        style={style}
        title={title || text}
        type="button"
        role="option"
        aria-selected={!!active}
        className={cx(
          styles.base,
          active && styles.active,
          hidden && styles.hidden,
          className,
          onClick && !hidden && styles.hover
        )}
        {...rest}
      >
        {highlightParts !== undefined ? (
          <PartialHighlighter text={text} highlightClassName={styles.matchHighLight} highlightParts={highlightParts} />
        ) : (
          <Highlighter
            textToHighlight={text}
            searchWords={searchWords}
            autoEscape
            highlightClassName={styles.matchHighLight}
          />
        )}
      </button>
    );
  }
);

Label.displayName = 'Label';

const getLabelStyles = (theme: GrafanaTheme2) => ({
  base: css({
    display: 'inline-block',
    cursor: 'pointer',
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.bodySmall.lineHeight,
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
    textShadow: 'none',
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    border: 'none',
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),
  active: css({
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
  }),
  matchHighLight: css({
    background: 'inherit',
    color: theme.components.textHighlight.text,
    backgroundColor: theme.components.textHighlight.background,
  }),
  hidden: css({
    opacity: 0.6,
    cursor: 'default',
    border: '1px solid transparent',
  }),
  hover: css({
    ['&:hover']: {
      opacity: 0.85,
      cursor: 'pointer',
    },
  }),
});
