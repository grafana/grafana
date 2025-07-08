import { css } from '@emotion/css';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
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
        <p className={styles.externalLinksHeading}>
          <Trans i18nKey="grafana-ui.field-link-list.external-links-heading">External links</Trans>
        </p>
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
  wrapper: css({
    flexBasis: '150px',
    width: '100px',
    marginTop: theme.spacing(1),
  }),
  externalLinksHeading: css({
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.size.sm,
    margin: 0,
  }),
  externalLink: css({
    color: theme.colors.text.link,
    fontWeight: theme.typography.fontWeightRegular,
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',

    '&:hover': {
      textDecoration: 'underline',
    },

    div: {
      marginRight: theme.spacing(1),
    },
  }),
});
