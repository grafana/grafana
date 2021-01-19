import React, { forwardRef, HTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '@grafana/ui';
// @ts-ignore
import Highlighter from 'react-highlight-words';

/**
 * @public
 */
export type OnLabelClick = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => any;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  name: string;
  active?: boolean;
  loading?: boolean;
  searchTerm?: RegExp;
  value?: string;
  facets?: number;
  onClick?: OnLabelClick;
}

export const LokiLabel = forwardRef<HTMLElement, Props>(
  ({ name, value, hidden, facets, onClick, className, loading, searchTerm, active, style, ...rest }, ref) => {
    const theme = useTheme();
    const styles = getLabelStyles(theme);

    const onLabelClick = (event: React.MouseEvent<HTMLElement>) => {
      if (onClick && !hidden) {
        onClick(name, value, event);
      }
    };
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
        title={text}
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
        <Highlighter textToHighlight={text} searchWords={[searchTerm]} highlightClassName={styles.matchHighLight} />
      </span>
    );
  }
);

LokiLabel.displayName = 'LokiLabel';

const getLabelStyles = (theme: GrafanaTheme) => ({
  base: css`
    cursor: pointer;
    font-size: ${theme.typography.size.sm};
    line-height: ${theme.typography.lineHeight.xs};
    border: 1px solid ${theme.colors.border1};
    vertical-align: baseline;
    color: ${theme.colors.text};
    white-space: nowrap;
    text-shadow: none;
    padding: 3px 6px;
    border-radius: ${theme.border.radius.md};
    margin-right: ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.xs};
    text-overflow: ellipsis;
    overflow: hidden;
  `,
  loading: css`
    font-weight: ${theme.typography.weight.semibold};
    background-color: ${theme.colors.formSwitchBgHover};
    color: ${theme.palette.gray98};
    animation: pulse 3s ease-out 0s infinite normal forwards;
    @keyframes pulse {
      0% {
        color: ${theme.colors.textSemiWeak};
      }
      50% {
        color: ${theme.colors.textFaint};
      }
      100% {
        color: ${theme.colors.textSemiWeak};
      }
    }
  `,
  active: css`
    font-weight: ${theme.typography.weight.semibold};
    background-color: ${theme.colors.formSwitchBgActive};
    color: ${theme.colors.formSwitchDot};
  `,
  matchHighLight: css`
    background: inherit;
    color: ${theme.palette.yellow};
    background-color: rgba(${theme.palette.yellow}, 0.1);
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
