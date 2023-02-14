import React from 'react';

import { useStyles2 } from '@grafana/ui';
import { getPerconaUser } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { URL_DOC } from './ModalBody.constants';
import { Messages } from './ModalBody.messages';
import { getStyles } from './ModalBody.styles';

export const ModalBody = () => {
  const { isPlatformUser } = useSelector(getPerconaUser);
  const styles = useStyles2(getStyles);
  return (
    <p>
      {isPlatformUser ? (
        Messages.modalBodyPlatformUser
      ) : (
        <>
          <span data-testid="force-disconnect-modal">{Messages.modalBody} </span>
          <a href={URL_DOC} rel="noreferrer noopener" target="_blank" className={styles.link}>
            {Messages.readMore}
          </a>
        </>
      )}
    </p>
  );
};
