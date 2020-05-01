import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  header?: string | JSX.Element;
}

/**
 * This is a simple InfoBox component, the api is not considered stable yet and will likely see breaking changes
 * in future minor releases.
 * @Alpha
 */
export const InfoBox = React.memo(
  React.forwardRef<HTMLDivElement, Props>(({ header, className, children, ...otherProps }, ref) => {
    const theme = useTheme();
    const css = getInfoBoxStyles(theme);

    return (
      <div className={cx([css.wrapper, className])} {...otherProps} ref={ref}>
        {header && (
          <div className={css.header}>
            <div className={css.headerText}>{header}</div>
          </div>
        )}
        <div className={css.body}>{children}</div>
      </div>
    );
  })
);

const getInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    position: relative;
    background-color: ${theme.colors.bg2};
    border-top: 3px solid ${theme.palette.blue80};
    margin-bottom: ${theme.spacing.md};
    flex-grow: 1;

    ul {
      padding-left: ${theme.spacing.lg};
    }

    code {
      @include font-family-monospace();
      font-size: ${theme.typography.size.sm};
      background-color: ${theme.colors.bg1};
      color: ${theme.colors.text};
      border: 1px solid ${theme.colors.border2};
      border-radius: 4px;
    }

    p:last-child {
      margin-bottom: 0;
    }

    &--max-lg {
      max-width: ${theme.breakpoints.lg};
    }
  `,
  headerText: css`
    font-size: ${theme.typography.heading.h5};
    flex-grow: 1;
  `,
  header: css`
    display: flex;
    align-items: center;
    padding: ${theme.spacing.md} ${theme.spacing.md} 0 ${theme.spacing.md};
  `,
  body: css`
    padding: ${theme.spacing.md};
  `,
}));
