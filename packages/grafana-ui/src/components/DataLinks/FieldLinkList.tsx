import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme, LinkModel } from '@grafana/data';

import { useStyles } from '../../themes';
import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';

import { DataLinkButton } from './DataLinkButton';

type Props = {
  links: Array<LinkModel<Field>>;
};

/**
 * @internal
 */
export function FieldLinkList({ links }: Props) {
  const styles = useStyles(getStyles);

  if (links.length === 1) {
    return (
      <MaybeErrorBadge link={links[0]}>
        <DataLinkButton link={links[0]} />
      </MaybeErrorBadge>
    );
  }

  const externalLinks = links.filter((link) => link.target === '_blank');
  const internalLinks = links.filter((link) => link.target === '_self');

  return (
    <>
      {internalLinks.map((link, i) => {
        return (
          <MaybeErrorBadge link={link} key={i}>
            <DataLinkButton link={link} />
          </MaybeErrorBadge>
        );
      })}
      <div className={styles.wrapper}>
        <p className={styles.externalLinksHeading}>External links</p>
        {externalLinks.map((link, i) => (
          <MaybeErrorBadge link={link} key={i}>
            <a href={link.href} target={link.target} className={styles.externalLink}>
              <Icon name="external-link-alt" />
              {link.title}
            </a>
          </MaybeErrorBadge>
        ))}
      </div>
    </>
  );
}

type MaybeErrorBadgeProps = {
  link: LinkModel<Field>;
};

/**
 * @internal
 */
const MaybeErrorBadge: React.FC<MaybeErrorBadgeProps> = (props) => {
  const { link, children } = props;
  return link.origin.config.links && link.origin.config.links[0].error ? (
    <Badge text={link.title} tooltip={link.error} color="red" icon="external-link-alt" />
  ) : (
    <>{children}</>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    flex-basis: 150px;
    width: 100px;
    border: solid 2px red;
    margin-top: ${theme.spacing.sm};
  `,
  externalLinksHeading: css`
    color: ${theme.colors.textWeak};
    font-weight: ${theme.typography.weight.regular};
    font-size: ${theme.typography.size.sm};
    margin: 0;
  `,
  externalLink: css`
    color: ${theme.colors.linkExternal};
    font-weight: ${theme.typography.weight.regular};
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      text-decoration: underline;
    }

    div {
      margin-right: ${theme.spacing.sm};
    }
  `,
});
