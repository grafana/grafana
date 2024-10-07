import React, { FC, PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

import { useStyles2 } from '@grafana/ui';

import { PMM_ADVANCED_SETTINGS_URL } from './InfoBox.constants';
import { Messages } from './InfoBox.messages';
import { getStyles } from './InfoBox.styles';
import { InfoBoxProps } from './InfoBoxProps.types';

const UpdateInfo: FC<PropsWithChildren> = ({ children }) => {
  const styles = useStyles2(getStyles);

  return (
    <section data-testid="updates-info" className={styles.infoBox}>
      {children}
    </section>
  );
};

export const InfoBox: FC<InfoBoxProps> = ({ upToDate = false, hasNoAccess, updatesDisabled, isOnline = true }) => {
  const styles = useStyles2(getStyles);

  if (hasNoAccess) {
    return (
      <UpdateInfo>
        <p>{Messages.noAccess}</p>
      </UpdateInfo>
    );
  }

  if (!isOnline) {
    return (
      <UpdateInfo>
        <p>{Messages.notOnline}</p>
      </UpdateInfo>
    );
  }

  if (updatesDisabled) {
    return (
      <UpdateInfo>
        <p data-testid="updates-disabled">
          {Messages.updatesDisabled}
          <Link className={styles.link} to={PMM_ADVANCED_SETTINGS_URL}>
            {Messages.pmmSettings}
          </Link>
        </p>
      </UpdateInfo>
    );
  }

  if (upToDate) {
    return (
      <UpdateInfo>
        <p>{Messages.upToDate}</p>
      </UpdateInfo>
    );
  }

  return (
    <UpdateInfo>
      <p>{Messages.noUpdates}</p>
      <p>{Messages.updatesNotice}</p>
    </UpdateInfo>
  );
};
