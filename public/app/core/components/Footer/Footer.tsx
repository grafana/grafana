import React, { FC } from 'react';
import config from 'app/core/config';

export interface FooterLink {
  text: string;
  icon?: string;
  url?: string;
  target?: string;
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

export let getVersionLinks = (): FooterLink[] => {
  const { buildInfo, licenseInfo } = config;
  const links: FooterLink[] = [];
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';

  links.push({ text: `${buildInfo.edition}${stateInfo}`, url: licenseInfo.licenseUrl });
  links.push({ text: `v${buildInfo.version} (${buildInfo.commit})` });

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
  const links = getFooterLinks().concat(getVersionLinks());

  return (
    <footer className="footer">
      <div className="text-center">
        <ul>
          {links.map(link => (
            <li key={link.text}>
              <a href={link.url} target={link.target} rel="noopener">
                <i className={link.icon} /> {link.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
});
