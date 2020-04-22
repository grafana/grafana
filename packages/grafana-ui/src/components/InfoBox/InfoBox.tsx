import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';

export interface Props {
  header?: string | JSX.Element;
  footer?: string | JSX.Element;
  className?: string;
}

/**
 * This is a simple InfoBox component, the api is not considered stable yet and will likely see breaking changes
 * in future minor releases.
 * @Alpha
 */
export const InfoBox = React.memo(
  React.forwardRef<HTMLDivElement, React.PropsWithChildren<Props>>(({ header, footer, className, children }, ref) => {
    const theme = useTheme();
    const css = getInfoBoxStyles(theme);

    return (
      <div className={cx([css.wrapper, className])} ref={ref}>
        {header && (
          <div className={css.header}>
            <h5>{header}</h5>
          </div>
        )}
        {children}
        {footer && <div className={css.footer}>{footer}</div>}
      </div>
    );
  })
);

const getInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    position: relative;
    padding: ${theme.spacing.lg};
    background-color: ${theme.colors.bg2};
    border-top: 3px solid ${theme.palette.blue80};
    margin-bottom: ${theme.spacing.md};
    margin-right: ${theme.spacing.xs};
    box-shadow: ${theme.shadows.listItem};
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

    a {
      @extend .external-link;
    }

    &--max-lg {
      max-width: ${theme.breakpoints.lg};
    }
  `,
  header: css`
    margin-bottom: ${theme.spacing.d};
  `,
  footer: css`
    margin-top: ${theme.spacing.d};
  `,
}));
