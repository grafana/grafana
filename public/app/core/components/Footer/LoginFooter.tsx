import React, { FC } from 'react';

interface FooterLink {
  text: string;
  url?: string;
  target?: string;
}

const FOOTER_LINKS: FooterLink[] = [
  {
    text: 'Grafana',
    url: 'https://grafana.com/grafana',
    target: '_blank',
  },
  {
    text: 'Prometheus',
    url: 'https://prometheus.io',
    target: '_blank',
  },
  {
    text: 'Clickhouse',
    url: 'https://clickhouse.tech',
    target: '_blank',
  },
  {
    text: 'PostgreSQL',
    url: 'https://www.postgresql.org',
    target: '_blank',
  },
];

export const LoginFooter: FC = React.memo(() => {
  return (
    <footer className="footer">
      <div className="text-center">
        <div>Percona Monitoring and Management proudly powered by open source projects</div>
        <ul>
          {FOOTER_LINKS.map(link => (
            <li key={link.text}>
              <a href={link.url} target={link.target} rel="noopener noreferrer">
                {link.text}
              </a>
            </li>
          )).concat(<li>and more</li>)}
        </ul>
      </div>
    </footer>
  );
});
