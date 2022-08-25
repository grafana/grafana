import React, { FC } from 'react';

import { config } from '@grafana/runtime';
import { Icon, IconName } from '@grafana/ui';

export interface FooterLink {
  text: string;
  id?: string;
  icon?: IconName;
  url?: string;
}

export let getFooterLinks = (): FooterLink[] => {
  return [
    {
      text: 'Documentation',
      icon: 'document-info',
      url: 'https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer',
    },
    {
      text: 'Support',
      icon: 'question-circle',
      url: 'https://grafana.com/products/enterprise/?utm_source=grafana_footer',
    },
    {
      text: 'Community',
      icon: 'comments-alt',
      url: 'https://community.grafana.com/?utm_source=grafana_footer',
    },
  ];
};

export function getVersionMeta(version: string) {
  const containsHyphen = version.includes('-');
  const isBeta = version.includes('-beta');

  return {
    hasReleaseNotes: !containsHyphen || isBeta,
    isBeta,
  };
}

export let getVersionLinks = (): FooterLink[] => {
  const { buildInfo, licenseInfo } = config;
  const links: FooterLink[] = [];
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';

  links.push({ text: `${buildInfo.edition}${stateInfo}`, url: licenseInfo.licenseUrl });

  if (buildInfo.hideVersion) {
    return links;
  }

  const { hasReleaseNotes, isBeta } = getVersionMeta(buildInfo.version);
  const versionSlug = buildInfo.version.replace(/\./g, '-'); // replace all periods with hyphens
  const docsVersion = isBeta ? 'next' : 'latest';

  links.push({
    text: `v${buildInfo.version} (${buildInfo.commit})`,
    url: hasReleaseNotes
      ? `https://grafana.com/docs/grafana/${docsVersion}/release-notes/release-notes-${versionSlug}/`
      : undefined,
  });

  if (buildInfo.hasUpdate) {
    links.push({
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

export const Footer: FC = React.memo(() => {
  const links = getFooterLinks().concat(getVersionLinks());

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
    <a href={item.url} target="_blank" rel="noopener noreferrer" id={item.id}>
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
