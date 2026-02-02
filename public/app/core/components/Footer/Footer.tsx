import { css } from '@emotion/css';
import { memo, useState, useEffect } from 'react';

import { GrafanaTheme2, LinkTarget } from '@grafana/data';
// import { config } from '@grafana/runtime';
import { Icon, IconName, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { customConfigSrv, DefaultCustomConfiguration } from 'app/features/org/state/configuration';

export interface FooterLink {
  target: LinkTarget;
  text: string;
  id: string;
  icon?: IconName;
  url?: string;
}

// BMC code - inline change
export let getFooterLinks = (config?: any): FooterLink[] => {
  return [
    {
      target: '_blank',
      id: 'documentation',
      text: t('nav.help/documentation', 'Documentation'),
      icon: 'document-info',
      // BMC code - inline change
      url: config?.docLink || DefaultCustomConfiguration.docLink,
    },
    {
      target: '_blank',
      id: 'support',
      text: t('nav.help/support', 'Support'),
      icon: 'question-circle',
      // BMC code - inline change
      url: config?.supportLink || DefaultCustomConfiguration.supportLink,
    },
    {
      target: '_blank',
      id: 'community',
      text: t('nav.help/community', 'Community'),
      icon: 'comments-alt',
      // BMC code - inline change
      url: config?.communityLink || DefaultCustomConfiguration.communityLink,
    },
  ];
};

export function getVersionMeta(version: string) {
  const isBeta = version.includes('-beta');

  return {
    hasReleaseNotes: true,
    isBeta,
  };
}

// BMC code
/*
//author(kmejdi)
export function getVersionLinks(hideEdition?: boolean): FooterLink[] {
  const { buildInfo, licenseInfo } = config;
  const links: FooterLink[] = [];
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';

  if (!hideEdition) {
    links.push({
      target: '_blank',
      id: 'license',
      text: `${buildInfo.edition}${stateInfo}`,
      url: licenseInfo.licenseUrl,
    });
  }

  if (buildInfo.hideVersion) {
    return links;
  }

  const { hasReleaseNotes } = getVersionMeta(buildInfo.version);

  links.push({
    target: '_blank',
    id: 'version',
    text: buildInfo.versionString,
    url: hasReleaseNotes ? `https://github.com/grafana/grafana/blob/main/CHANGELOG.md` : undefined,
  });

  if (buildInfo.hasUpdate) {
    links.push({
      target: '_blank',
      id: 'updateVersion',
      text: `New version available!`,
      icon: 'download-alt',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
    });
  }

  return links;
};
//author(kmejdi) - End
*/

//author(kmejdi) - Start
//Update footer links
export let getVersionLinks = (): FooterLink[] => {
  return [];
};
//author(kmejdi) - End
// End
export function setFooterLinksFn(fn: typeof getFooterLinks) {
  getFooterLinks = fn;
}

export interface Props {
  /** Link overrides to show specific links in the UI */
  customLinks?: FooterLink[] | null;
  hideEdition?: boolean;
}

export const Footer = memo(({ customLinks, hideEdition }: Props) => {
  // BMC code
  // const links = (customLinks || getFooterLinks()).concat(getVersionLinks(hideEdition));
  const [links, setLinks] = useState<FooterLink[]>(() => getFooterLinks());
  useEffect(() => {
    customConfigSrv.getCustomConfiguration().then((data) => {
      const footerLinks = getFooterLinks(data).concat(getVersionLinks());
      setLinks(footerLinks);
    });
  }, []);
  // End
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.footer}>
      <div className="text-center">
        <ul className={styles.list}>
          {links.map((link, index) => (
            <li className={styles.listItem} key={index}>
              <FooterItem item={link} />
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

function FooterItem({ item }: { item: FooterLink }) {
  const content = item.url ? (
    <a href={item.url} target={item.target} rel="nofollow noopener noreferrer" id={item.id}>
      {item.text}
    </a>
  ) : (
    item.text
  );

  return (
    <>
      {item.icon && <Icon name={item.icon} />} {content}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    display: 'block',
    padding: theme.spacing(2, 0),
    position: 'relative',
    width: '98%',

    'a:hover': {
      color: theme.colors.text.maxContrast,
      textDecoration: 'underline',
    },

    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
  list: css({
    listStyle: 'none',
  }),
  listItem: css({
    display: 'inline-block',
    '&:after': {
      content: "' | '",
      padding: theme.spacing(0, 1),
    },
    '&:last-child:after': {
      content: "''",
      paddingLeft: 0,
    },
  }),
});
