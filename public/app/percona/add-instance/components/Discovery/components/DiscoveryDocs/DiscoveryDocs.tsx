import React, { FC } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { getStyles } from './DiscoveryDocs.styles';
import { Messages } from './DiscoveryDocs.messages';
import { IAM_ROLE_DOC_LINK, SECURITY_CREDENTIALS_DOC_LINK } from './DiscoveryDocs.constants';

export const DiscoveryDocs: FC = () => {
  const styles = useStyles(getStyles);

  return (
    <div data-qa="discovery-docs" className={styles.infoWrapper}>
      <ul className={styles.infoItems}>
        <li>
          <Button type="button" variant="link" onClick={() => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank')}>
            {Messages.credentialsDocLink}
          </Button>
        </li>
        <li>
          <Button type="button" variant="link" onClick={() => window.open(IAM_ROLE_DOC_LINK, '_blank')}>
            {Messages.iamRoleDocLink}
          </Button>
        </li>
      </ul>
    </div>
  );
};
