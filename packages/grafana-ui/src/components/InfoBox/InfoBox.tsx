import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { HorizontalGroup } from '../Layout/Layout';
import panelArtDark from './panelArt_dark.svg';
import panelArtLight from './panelArt_light.svg';

export interface InfoBoxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  title?: string | JSX.Element;
  url?: string;
  urlTitle?: string;
  branded?: boolean;
  onDismiss?: () => void;
}

/**
 * This is a simple InfoBox component, the api is not considered stable yet and will likely see breaking changes
 * in future minor releases.
 * @Alpha
 */
export const InfoBox = React.memo(
  React.forwardRef<HTMLDivElement, InfoBoxProps>(
    ({ title, className, children, branded, url, urlTitle, onDismiss, ...otherProps }, ref) => {
      const theme = useTheme();
      const styles = getInfoBoxStyles(theme);
      const wrapperClassName = branded ? cx(styles.wrapperBranded, className) : cx(styles.wrapper, className);

      return (
        <div className={wrapperClassName} {...otherProps} ref={ref}>
          <div>
            <HorizontalGroup justify={'space-between'} align={'flex-start'}>
              <div>{typeof title === 'string' ? <h4>{title}</h4> : title}</div>
              {onDismiss && <IconButton name={'times'} onClick={onDismiss} />}
            </HorizontalGroup>
          </div>
          <div>{children}</div>
          {url && (
            <a href={url} className={styles.docsLink} target="_blank">
              <Icon name="book" /> {urlTitle || 'Read more'}
            </a>
          )}
        </div>
      );
    }
  )
);

const getInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    position: relative;
    padding: ${theme.spacing.md};
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
  wrapperBranded: css`
    padding: ${theme.spacing.md};
    border-radius: ${theme.border.radius.md};
    position: relative;
    box-shadow: 0 0 30px 10px rgba(0, 0, 0, ${theme.isLight ? 0.05 : 0.2});
    z-index: 0;

    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url(${theme.isLight ? panelArtLight : panelArtDark});
      border-radius: ${theme.border.radius.md};
      background-position: 50% 50%;
      background-size: cover;
      filter: saturate(80%);
      z-index: -1;
    }

    p:last-child {
      margin-bottom: 0;
    }
  `,
  docsLink: css`
    display: inline-block;
    margin-top: ${theme.spacing.lg};
    font-size: ${theme.typography.size.sm};
  `,
}));
