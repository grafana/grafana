import React from 'react';

import { locationService } from '@grafana/runtime/src/services/LocationService';
import { useStyles2 } from '@grafana/ui';
import { AlertLocalStorage } from 'app/percona/shared/components/Elements/AlertLocalStorage/AlertLocalStorage';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { Messages } from './CheckInfoAlert.messages';
import { getStyles } from './CheckInfoAlert.styles';

export const ChecksInfoAlert = () => {
  const { result } = useSelector(getPerconaSettings);
  const { isConnectedToPortal } = result!;
  const styles = useStyles2(getStyles);

  if (isConnectedToPortal) {
    return null;
  }

  return (
    <AlertLocalStorage
      title={Messages.title}
      customButtonContent={Messages.buttonText}
      onCustomButtonClick={() => locationService.push(`/settings/percona-platform`)}
      uniqueName={'connectInfoAlert'}
    >
      <div className={styles.content}>
        <a
          data-testid="read-more-link"
          target="_blank"
          rel="noreferrer"
          href={'https://www.percona.com/software/percona-platform/subscription'}
          className={styles.link}
        >
          {Messages.link}
        </a>{' '}
        {Messages.content} <br /> {Messages.contentSecondPart} <i>{Messages.advisorsList}</i>{' '}
        {Messages.contentThirdPart}
      </div>
    </AlertLocalStorage>
  );
};
