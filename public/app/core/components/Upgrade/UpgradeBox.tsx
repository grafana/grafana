import { css, cx } from '@emotion/css';
import { HTMLAttributes, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportExperimentView } from '@grafana/runtime/src';
import { Button, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

type ComponentSize = 'sm' | 'md';

export interface Props extends HTMLAttributes<HTMLOrSVGElement> {
  featureName: string;
  size?: ComponentSize;
  text?: string;
  eventVariant?: string;
  featureId: string;
}

export const UpgradeBox = ({
  featureName,
  className,
  children,
  text,
  featureId,
  eventVariant = '',
  size = 'md',
  ...htmlProps
}: Props) => {
  const styles = useStyles2(getUpgradeBoxStyles, size);

  useEffect(() => {
    reportExperimentView(`feature-highlights-${featureId}`, 'test', eventVariant);
  }, [eventVariant, featureId]);

  return (
    <div className={cx(styles.box, className)} {...htmlProps}>
      <Icon name={'rocket'} className={styles.icon} />
      <div className={styles.inner}>
        <p className={styles.text}>
          <Trans i18nKey="upgrade-box.discovery-text">You’ve discovered a Pro feature!</Trans>{' '}
          {text ||
            t('upgrade-box.discovery-text-continued', 'Get the Grafana Pro plan to access {{featureName}}.', {
              featureName,
            })}
        </p>
        <LinkButton
          variant="secondary"
          size={size}
          className={styles.button}
          href="https://grafana.com/profile/org/subscription"
          target="__blank"
          rel="noopener noreferrer"
        >
          <Trans i18nKey="upgrade-box.upgrade-button">Upgrade</Trans>
        </LinkButton>
      </div>
    </div>
  );
};

const getUpgradeBoxStyles = (theme: GrafanaTheme2, size: ComponentSize) => {
  const borderRadius = theme.shape.borderRadius(2);
  const fontBase = size === 'md' ? 'body' : 'bodySmall';

  return {
    box: css({
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      borderRadius: borderRadius,
      background: theme.colors.success.transparent,
      padding: theme.spacing(2),
      color: theme.colors.success.text,
      fontSize: theme.typography[fontBase].fontSize,
      textAlign: 'left',
      lineHeight: '16px',
      margin: theme.spacing(0, 'auto', 3, 'auto'),
      maxWidth: `${theme.breakpoints.values.xxl}px`,
      width: '100%',
    }),
    inner: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'space-between',
    }),
    text: css({
      margin: 0,
    }),
    button: css({
      backgroundColor: theme.colors.success.main,
      fontWeight: theme.typography.fontWeightLight,
      color: 'white',

      '&:hover': {
        backgroundColor: theme.colors.success.main,
      },

      '&:focus-visible': {
        boxShadow: 'none',
        color: theme.colors.text.primary,
        outline: `2px solid ${theme.colors.primary.main}`,
      },
    }),
    icon: css({
      margin: theme.spacing(0.5, 1, 0.5, 0.5),
    }),
  };
};

export interface UpgradeContentProps {
  image: string;
  featureUrl?: string;
  featureName: string;
  description?: string;
  listItems: string[];
  caption?: string;
  action?: {
    text: string;
    link?: string;
    onClick?: () => void;
  };
}

export const UpgradeContent = ({
  listItems,
  image,
  featureUrl,
  featureName,
  description,
  caption,
  action,
}: UpgradeContentProps) => {
  const styles = useStyles2(getUpgradeContentStyles);
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h3 className={styles.title}>
          <Trans i18nKey="upgrade-box.get-started">Get started with {{ featureName }}</Trans>
        </h3>
        {description && <h6 className={styles.description}>{description}</h6>}
        <ul className={styles.list}>
          {listItems.map((item, index) => (
            <li key={index}>
              <Icon name={'check'} size={'xl'} className={styles.icon} /> {item}
            </li>
          ))}
        </ul>
        {action?.link && (
          <LinkButton variant={'primary'} href={action.link}>
            {action.text}
          </LinkButton>
        )}
        {action?.onClick && (
          <Button variant={'primary'} onClick={action.onClick}>
            {action.text}
          </Button>
        )}
        {featureUrl && (
          <LinkButton fill={'text'} href={featureUrl} className={styles.link} target="_blank" rel="noreferrer noopener">
            <Trans i18nKey="upgrade-box.learn-more">Learn more</Trans>
          </LinkButton>
        )}
      </div>
      <div className={styles.media}>
        <img src={getImgUrl(image)} alt={'Feature screenshot'} />
        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
    </div>
  );
};

const getUpgradeContentStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'space-between',
    }),
    content: css({
      width: '45%',
      marginRight: theme.spacing(4),
    }),
    media: css({
      width: '55%',

      img: {
        width: '100%',
      },
    }),
    title: css({
      color: theme.colors.text.maxContrast,
    }),
    description: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightLight,
    }),
    list: css({
      listStyle: 'none',
      margin: theme.spacing(4, 0, 2, 0),

      li: {
        display: 'flex',
        alignItems: 'flex-start',
        color: theme.colors.text.primary,
        padding: theme.spacing(1, 0),
      },
    }),
    icon: css({
      color: theme.colors.success.main,
      marginRight: theme.spacing(1),
    }),
    link: css({
      marginLeft: theme.spacing(2),
    }),
    caption: css({
      fontWeight: theme.typography.fontWeightLight,
      margin: theme.spacing(1, 0, 0),
    }),
  };
};

export const UpgradeContentVertical = ({
  featureName,
  description,
  featureUrl,
  image,
}: Omit<UpgradeContentProps, 'listItems' | 'caption'>) => {
  const styles = useStyles2(getContentVerticalStyles);
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <Trans i18nKey="upgrade-box.get-started">Get started with {{ featureName }}</Trans>
      </h3>
      {description && <h6 className={styles.description}>{description}</h6>}
      <LinkButton fill={'text'} href={featureUrl} target="_blank" rel="noreferrer noopener">
        <Trans i18nKey="upgrade-box.learn-more">Learn more</Trans>
      </LinkButton>
      <div className={styles.media}>
        <img src={getImgUrl(image)} alt={'Feature screenshot'} />
      </div>
    </div>
  );
};

const getContentVerticalStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      overflow: 'auto',
      height: '100%',
    }),
    title: css({
      color: theme.colors.text.maxContrast,
    }),
    description: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightLight,
    }),
    media: css({
      width: '100%',
      marginTop: theme.spacing(2),

      img: {
        width: '100%',
      },
    }),
  };
};

const getImgUrl = (urlOrId: string) => {
  if (urlOrId.startsWith('http')) {
    return urlOrId;
  }

  return '/public/img/enterprise/highlights/' + urlOrId;
};
