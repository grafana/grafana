import React, { FC } from 'react';

import { Button, useStyles } from '@grafana/ui';

import { IAM_ROLE_DOC_LINK, SECURITY_CREDENTIALS_DOC_LINK } from './DiscoveryDocs.constants';
import { Messages } from './DiscoveryDocs.messages';
import { getStyles } from './DiscoveryDocs.styles';

export const DiscoveryDocs: FC<React.PropsWithChildren<unknown>> = () => {
  const styles = useStyles(getStyles);

  return (
    <div data-testid="discovery-docs" className={styles.infoWrapper}>
      <ul className={styles.infoItems}>
        <li>
          <Button type="button" fill="text" onClick={() => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank')}>
            {Messages.credentialsDocLink}
          </Button>
        </li>
        <li>
          <Button type="button" fill="text" onClick={() => window.open(IAM_ROLE_DOC_LINK, '_blank')}>
            {Messages.iamRoleDocLink}
          </Button>
        </li>
      </ul>
    </div>
  );
};
