import React, { FC } from 'react';
import config from 'app/core/config';

interface FooterLink {
  text: string;
  icon?: string;
  url?: string;
}

let getFooterLinks = (): FooterLink[] => {
  const { buildInfo } = config;

  const links = [
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
    {
      text: `Grafana v${buildInfo.version} (commit: ${buildInfo.commit})`,
      icon: 'fa fa-comments-o',
    },
  ];

  if (buildInfo.hasUpdate) {
    links.push({
      text: `New version available`,
      icon: 'fa fa-download',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
    });
  }

  return links;
};

export function setFooterLinksFn(fn: typeof getFooterLinks) {
  getFooterLinks = fn;
}

export const Footer: FC = React.memo(() => {
  const links = getFooterLinks();

  return (
    <footer className="footer">
      <div className="text-center">
        <ul>
          {links.map(link => (
            <li>
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
