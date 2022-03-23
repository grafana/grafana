import React, { HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

type ComponentSize = 'sm' | 'md';

export interface Props extends HTMLAttributes<HTMLOrSVGElement> {
  featureName: string;
  size?: ComponentSize;
}

export const UpgradeBox = ({ featureName, className, children, size = 'md', ...htmlProps }: Props) => {
  const styles = useStyles2((theme) => getUpgradeBoxStyles(theme, size));

  return (
    <div className={cx(styles.box, className)} {...htmlProps}>
      <Icon name={'rocket'} className={styles.icon} />
      <div className={styles.inner}>
        <p className={styles.text}>
          You’ve discovered a Pro feature! Get the Grafana Pro plan to access {featureName}.
        </p>
        <LinkButton
          variant="secondary"
          size={size}
          className={styles.button}
          href="https://grafana.com/profile/org/subscription"
          target="__blank"
          rel="noopener noreferrer"
        >
          Upgrade
        </LinkButton>
      </div>
    </div>
  );
};

const getUpgradeBoxStyles = (theme: GrafanaTheme2, size: ComponentSize) => {
  const borderRadius = theme.shape.borderRadius(2);
  const fontBase = size === 'md' ? 'body' : 'bodySmall';

  return {
    box: css`
      display: flex;
      align-items: center;
      position: relative;
      border-radius: ${borderRadius};
      background: ${theme.colors.success.transparent};
      padding: ${theme.spacing(2)};
      color: ${theme.colors.success.text};
      font-size: ${theme.typography[fontBase].fontSize};
      text-align: left;
      line-height: 16px;
      margin: ${theme.spacing(0, 'auto', 3, 'auto')};
      max-width: ${theme.breakpoints.values.xxl}px;
      width: 100%;
    `,
    inner: css`
      display: flex;
      align-items: center;
      width: 100%;
      justify-content: space-between;
    `,
    text: css`
      margin: 0;
    `,
    button: css`
      background-color: ${theme.colors.success.main};
      font-weight: ${theme.typography.fontWeightLight};
      color: white;

      &:hover {
        background-color: ${theme.colors.success.main};
      }

      &:focus-visible {
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
      }
    `,
    icon: css`
      margin: ${theme.spacing(0.5, 1, 0.5, 0.5)};
    `,
  };
};

export interface UpgradeContentProps {
  listItems: string[];
  image: string;
  featureUrl?: string;
  featureName: string;
  description?: string;
  caption?: string;
}
export const UpgradeContent = ({
  listItems,
  image,
  featureUrl,
  featureName,
  description,
  caption,
}: UpgradeContentProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h3 className={styles.title}>Get started with {featureName}</h3>
        {description && <h6 className={styles.description}>{description}</h6>}
        <ul className={styles.list}>
          {listItems.map((item, index) => (
            <li key={index}>
              <Icon name={'check'} size={'xl'} className={styles.icon} /> {item}
            </li>
          ))}
        </ul>
        {featureUrl && (
          <LinkButton variant={'link'} href={featureUrl} className={styles.link}>
            Learn more
          </LinkButton>
        )}
      </div>
      <div className={styles.media}>
        <img src={image} alt={'Feature screenshot'} />
        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      justify-content: space-between;
    `,
    content: css`
      width: 45%;
      margin-right: ${theme.spacing(4)};
    `,
    media: css`
      width: 55%;

      img {
        width: 100%;
      }
    `,
    description: css`
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightLight};
    `,
    list: css`
      list-style: none;
      margin: ${theme.spacing(4, 0, 2, 0)};

      li {
        display: flex;
        align-items: center;
        line-height: 3;
        color: ${theme.colors.text.primary};
      }
    `,

    icon: css`
      color: ${theme.colors.success.main};
      margin-right: ${theme.spacing(1)};
    `,
    link: css`
      margin-left: ${theme.spacing(2)};
    `,
    title: css`
      color: ${theme.colors.text.maxContrast};
    `,
    caption: css`
      font-weight: ${theme.typography.fontWeightLight};
      margin: ${theme.spacing(1, 0, 0)};
    `,
  };
};
