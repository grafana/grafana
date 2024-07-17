import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { FOOTER_LINKS } from './LoginFooter.constants';
import { getStyles } from './LoginFooter.styles';

export const LoginFooter: FC = React.memo(() => {
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.footer}>
      <div className="text-center">
        <div>Percona Monitoring and Management proudly powered by open source projects</div>
        <ul>
          {FOOTER_LINKS.map((link) => (
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

LoginFooter.displayName = 'LoginFooter';

export default LoginFooter;
