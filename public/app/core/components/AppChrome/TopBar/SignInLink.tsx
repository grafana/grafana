import { css } from '@emotion/css';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, locationUtil, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
      <Trans i18nKey="app-chrome.top-bar.sign-in">Sign in</Trans>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
