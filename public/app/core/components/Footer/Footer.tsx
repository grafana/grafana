import React from 'react';

import { LinkTarget } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, IconName } from '@grafana/ui';

export interface FooterLink {
  target: LinkTarget;
  text: string;
  id: string;
  icon?: IconName;
  url?: string;
}

export let getFooterLinks = (): FooterLink[] => {
  return [
    {
      id: 'pmm-logs',
      text: 'PMM Logs',
      icon: 'download-alt',
      url: '/logs.zip',
      target: '_blank',
    },
    {
      id: 'pmm-docs',
      text: 'Documentation',
      icon: 'document-info',
      url: 'https://www.percona.com/doc/percona-monitoring-and-management/2.x/index.html?utm_source=pmm_footer',
      target: '_blank',
    },
    {
      target: '_blank',
      id: 'support',
      text: 'Support',
      icon: 'question-circle',
      url: 'https://www.percona.com/services/support?utm_source=pmm_footer',
    },
    {
      target: '_blank',
      id: 'community',
      text: 'Community',
      icon: 'comments-alt',
      url: 'https://forums.percona.com/c/percona-monitoring-and-management-pmm/percona-monitoring-and-management-pmm-v2?utm_source=pmm_footer',
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

export let getVersionLinks = (): FooterLink[] => {
  const { buildInfo, licenseInfo } = config;
  const links: FooterLink[] = [];
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';

  links.push({
    target: '_blank',
    id: 'version',
    text: `${buildInfo.edition}${stateInfo}`,
    url: licenseInfo.licenseUrl,
  });

  if (buildInfo.hideVersion) {
    return links;
  }

  const { hasReleaseNotes } = getVersionMeta(buildInfo.version);

  links.push({
    target: '_blank',
    id: 'version',
    text: `v${buildInfo.version} (${buildInfo.commit})`,
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

export function setFooterLinksFn(fn: typeof getFooterLinks) {
  getFooterLinks = fn;
}

export function setVersionLinkFn(fn: typeof getFooterLinks) {
  getVersionLinks = fn;
}

export interface Props {
  /** Link overrides to show specific links in the UI */
  customLinks?: FooterLink[] | null;
}

export const Footer = React.memo(({ customLinks }: Props) => {
  // @PERCONA
  // remove version links
  const links = customLinks || getFooterLinks();

  return (
    <footer className="footer">
      <div className="text-center">
        <ul>
          {links.map((link) => (
            <li key={link.text}>
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
    <a href={item.url} target={item.target} rel="noopener noreferrer" id={item.id}>
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
