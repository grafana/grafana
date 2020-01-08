import React, { FC } from 'react';
import config from 'app/core/config';

export interface FooterLink {
  text: string;
  icon?: string;
  url?: string;
}

export let getFooterLinks = (): FooterLink[] => {
  return [
    {
      text: 'Docs',
      icon: 'fa fa-file-code-o',
      url: 'https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer',
    },
    {
      text: 'Support & Enterprise',
      icon: 'fa fa-support',
      url: 'https://grafana.com/products/enterprise/?utm_source=grafana_footer',
    },
    {
      text: 'Community',
      icon: 'fa fa-comments-o',
      url: 'https://community.grafana.com/?utm_source=grafana_footer',
    },
  ];
};

export let getVersionLinks = (): FooterLink[] => {
  const { buildInfo } = config;

  const links: FooterLink[] = [
    {
      text: `Grafana v${buildInfo.version} (commit: ${buildInfo.commit})`,
      url: 'https://grafana.com',
    },
  ];

  if (buildInfo.hasUpdate) {
    links.push({
      text: `New version available!`,
      icon: 'fa fa-download',
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
