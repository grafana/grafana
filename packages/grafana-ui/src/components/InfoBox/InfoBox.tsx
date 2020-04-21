import React from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';

export interface InfoBoxProps {
  header?: string | JSX.Element;
  footer?: string | JSX.Element;
  className?: string;
}

const getInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    position: relative;
    padding: ${theme.spacing.lg};
    background-color: ${theme.colors.bg2};
    border-top: 3px solid ${theme.colors.textBlue};
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

export const InfoBox: React.FunctionComponent<InfoBoxProps> = ({ header, footer, className, children }) => {
  const theme = useTheme();
  const css = getInfoBoxStyles(theme);

  return (
    <div className={cx([css.wrapper, className])}>
      {header && (
        <div className={css.header}>
          <h5>{header}</h5>
        </div>
      )}
      {children}
      {footer && <div className={css.footer}>{footer}</div>}
    </div>
  );
};
