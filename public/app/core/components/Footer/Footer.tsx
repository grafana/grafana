import React, { FC } from 'react';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';

export interface FooterLink {
  text: string;
  icon?: string;
  url?: string;
  target: string;
}

export let getFooterLinks = (): FooterLink[] => {
  return [
    {
      text: 'Documentation',
      icon: 'fa fa-file-code-o',
      url: 'https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer',
      target: '_blank',
    },
    {
      text: 'Support',
      icon: 'fa fa-support',
      url: 'https://grafana.com/products/enterprise/?utm_source=grafana_footer',
      target: '_blank',
    },
    {
      text: 'Community',
      icon: 'fa fa-comments-o',
      url: 'https://community.grafana.com/?utm_source=grafana_footer',
      target: '_blank',
    },
  ];
};

export let getVersionLinks = (isGrafanaAdmin: boolean): FooterLink[] => {
  const { buildInfo, licenseInfo } = config;
  const enterpriseLink = isGrafanaAdmin
    ? licenseInfo.detailsLink
    : 'https://grafana.com/products/enterprise?utm_source=grafana_footer';

  const links: FooterLink[] = [
    {
      text: `Grafana v${buildInfo.version} (commit: ${buildInfo.commit})`,
      url: 'https://grafana.com',
      target: '_blank',
    },
    {
      text: buildInfo.edition,
      url: enterpriseLink,
      target: '_blank',
    },
  ];

  if (buildInfo.hasUpdate) {
    links.push({
      text: `New version available!`,
      icon: 'fa fa-download',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
      target: '_blank',
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
  const isGrafanaAdmin = contextSrv.isGrafanaAdmin;
  const links = getFooterLinks().concat(getVersionLinks(isGrafanaAdmin));

  return (
    <footer className="footer">
      <div className="text-center">
        <ul>
          {links.map(link => (
            <li key={link.text}>
              <a href={link.url} target="_blank" rel="noopener">
                <i className={link.icon} /> {link.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
});
