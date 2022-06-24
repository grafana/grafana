import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme, LinkModel } from '@grafana/data';

import { useStyles } from '../../themes';
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
    return shouldShowDataLink(links[0]) ? <DataLinkButton link={links[0]} /> : null;
  }

  const externalLinks = links.filter((link) => link.target === '_blank');
  const internalLinks = links.filter((link) => link.target === '_self');

  return (
    <>
      {internalLinks.map((link, i) => {
        return shouldShowDataLink(link) ? <DataLinkButton link={link} key={i} /> : null;
      })}
      <div className={styles.wrapper}>
        <p className={styles.externalLinksHeading}>External links</p>
        {externalLinks.map(
          (link, i) =>
            shouldShowDataLink(link) && (
              <a href={link.href} target={link.target} className={styles.externalLink} key={i}>
                <Icon name="external-link-alt" />
                {link.title}
              </a>
            )
        )}
      </div>
    </>
  );
}

function shouldShowDataLink(link: LinkModel<Field>): boolean {
  return !(link.origin.config.links && link.origin.config.links[0].error);
}

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    flex-basis: 150px;
    width: 100px;
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
