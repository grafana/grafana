import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function SignInLink() {
  const location = useLocation();
  const styles = useStyles2(getStyles);
  const loginUrl = locationUtil.getUrlForPartial(location, { forceLogin: 'true' });

  return (
    <a className={styles.link} href={loginUrl} target="_self">
      Sign in
    </a>
  );
}

const getStyles = () => {
  return {
    link: css({
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
