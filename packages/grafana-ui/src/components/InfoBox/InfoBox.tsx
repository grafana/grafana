import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useStyles2 } from '../../themes';
import { Alert, AlertVariant } from '../Alert/Alert';
import { Icon } from '../Icon/Icon';

export interface InfoBoxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  /** Title of the box */
  title?: string | JSX.Element;
  /** Url of the read more link */
  url?: string;
  /** Text of the read more link */
  urlTitle?: string;
  /** Indicates whether or not box should be rendered with Grafana branding background */
  branded?: boolean;
  /** Color variant of the box */
  severity?: AlertVariant;
  /** Call back to be performed when box is dismissed */
  onDismiss?: () => void;
}

/** @deprecated use Alert with severity info */
export const InfoBox = React.memo(
  React.forwardRef<HTMLDivElement, InfoBoxProps>(
    ({ title, className, children, branded, url, urlTitle, onDismiss, severity = 'info', ...otherProps }, ref) => {
      const styles = useStyles2(getStyles);

      return (
        <Alert severity={severity} className={className} {...otherProps} ref={ref} title={title as string}>
          <div>{children}</div>
          {url && (
            <a href={url} className={cx('external-link', styles.docsLink)} target="_blank" rel="noreferrer">
              <Icon name="book" /> {urlTitle || 'Read more'}
            </a>
          )}
        </Alert>
      );
    }
  )
);

InfoBox.displayName = 'InfoBox';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    docsLink: css`
      display: inline-block;
      margin-top: ${theme.spacing(2)};
    `,
  };
});
