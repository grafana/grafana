import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { DataLinkButton } from './DataLinkButton';

type Props = {
  links: Array<LinkModel<Field>>;
};

/**
 * @internal
 */
export function FieldLinkList({ links }: Props) {
  const styles = useStyles2(getStyles);

  if (links.length === 1) {
    return <DataLinkButton link={links[0]} />;
  }

  const externalLinks = links.filter((link) => link.target === '_blank');
  const internalLinks = links.filter((link) => link.target === '_self');

  return (
    <>
      {internalLinks.map((link, i) => {
        return <DataLinkButton key={i} link={link} />;
      })}
      <div className={styles.wrapper}>
        <p className={styles.externalLinksHeading}>External links</p>
        {externalLinks.map((link, i) => (
          <a key={i} href={link.href} target={link.target} className={styles.externalLink}>
            <Icon name="external-link-alt" />
            {link.title}
          </a>
        ))}
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    flex-basis: 150px;
    width: 100px;
    margin-top: ${theme.spacing(1)};
  `,
  externalLinksHeading: css`
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeightRegular};
    font-size: ${theme.typography.size.sm};
    margin: 0;
  `,
  externalLink: css`
    color: ${theme.colors.text.link};
    font-weight: ${theme.typography.fontWeightRegular};
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      text-decoration: underline;
    }

    div {
      margin-right: ${theme.spacing(1)};
    }
  `,
});
