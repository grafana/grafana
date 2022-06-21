import { cx, css } from '@emotion/css';
import React, { forwardRef, HTMLAttributes, useCallback } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { HighlightPart } from '../../types';
import { PartialHighlighter } from '../Typeahead/PartialHighlighter';

type OnLabelClick = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => void;

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  name: string;
  active?: boolean;
  loading?: boolean;
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
export const Label = forwardRef<HTMLElement, Props>(
  (
    {
      name,
      value,
      hidden,
      facets,
      onClick,
      className,
      loading,
      searchTerm,
      active,
      style,
      title,
      highlightParts,
      ...rest
    },
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
      <span
        key={text}
        ref={ref}
        onClick={onLabelClick}
        style={style}
        title={title || text}
        role="option"
        aria-selected={!!active}
        className={cx(
          styles.base,
          active && styles.active,
          loading && styles.loading,
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
      </span>
    );
  }
);

Label.displayName = 'Label';

const getLabelStyles = (theme: GrafanaTheme2) => ({
  base: css`
    display: inline-block;
    cursor: pointer;
    font-size: ${theme.typography.size.sm};
    line-height: ${theme.typography.bodySmall.lineHeight};
    background-color: ${theme.colors.background.secondary};
    color: ${theme.colors.text};
    white-space: nowrap;
    text-shadow: none;
    padding: ${theme.spacing(0.5)};
    border-radius: ${theme.shape.borderRadius()};
    margin-right: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  loading: css`
    font-weight: ${theme.typography.fontWeightMedium};
    background-color: ${theme.colors.primary.shade};
    color: ${theme.colors.text.primary};
    animation: pulse 3s ease-out 0s infinite normal forwards;
    @keyframes pulse {
      0% {
        color: ${theme.colors.text.primary};
      }
      50% {
        color: ${theme.colors.text.secondary};
      }
      100% {
        color: ${theme.colors.text.disabled};
      }
    }
  `,
  active: css`
    font-weight: ${theme.typography.fontWeightMedium};
    background-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
  `,
  matchHighLight: css`
    background: inherit;
    color: ${theme.components.textHighlight.text};
    background-color: ${theme.components.textHighlight.background};
  `,
  hidden: css`
    opacity: 0.6;
    cursor: default;
    border: 1px solid transparent;
  `,
  hover: css`
    &:hover {
      opacity: 0.85;
      cursor: pointer;
    }
  `,
});
