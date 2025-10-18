import { css } from '@emotion/css';
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, locationUtil, textUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { isFrontendService } from 'app/core/utils/isFrontendService';

export function SignInLink() {
  const femt = isFrontendService();
  const location = useLocation();
  const styles = useStyles2(getStyles);
  let loginUrl = femt
    ? locationUtil.assureBaseUrl('/login')
    : textUtil.sanitizeUrl(locationUtil.getUrlForPartial(location, { forceLogin: 'true' }));

  // Fix for loginUrl starting with "//" which is a scheme relative URL
  if (loginUrl.startsWith('//')) {
    loginUrl = loginUrl.replace(/\/+/g, '/');
  }

  const handleOnClick = useCallback(() => {
    contextSrv.setRedirectToUrl();
  }, []);

  return (
    <a className={styles.link} onClick={handleOnClick} href={loginUrl} target={femt ? undefined : '_self'}>
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
