import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, locationUtil, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function SignInLink() {
  const location = useLocation();
  const styles = useStyles2(getStyles);
  let loginUrl = textUtil.sanitizeUrl(locationUtil.getUrlForPartial(location, { forceLogin: 'true' }));

  // Fix for loginUrl starting with "//" which is a scheme relative URL
  if (loginUrl.startsWith('//')) {
    loginUrl = loginUrl.replace(/\/+/g, '/');
  }

  return (
    <a className={styles.link} href={loginUrl} target="_self">
      Sign in
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      paddingRight: theme.spacing(1),
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
