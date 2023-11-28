import React, { FC } from 'react';

import { Icon, Tooltip, useStyles } from '@grafana/ui';

import { useToggleOnAltClick } from '../../hooks';
import { CurrentVersionProps } from '../../types';

import { Messages } from './CurrentVersion.messages';
import { getStyles } from './CurrentVersion.styles';

export const CurrentVersion: FC<CurrentVersionProps> = ({ installedVersionDetails }) => {
  const styles = useStyles(getStyles);
  const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);
  const { installedVersionDate, installedVersion, installedFullVersion } = installedVersionDetails;

  return (
    <section className={styles.currentVersion}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span onClick={handleToggleShowFullVersion}>
        {Messages.currentVersion}:&nbsp;
        <span>
          <span data-testid="update-installed-version">
            {showFullVersion ? installedFullVersion : installedVersion}
          </span>
          &nbsp;
          <span data-testid="update-installed-release-date" className={styles.releaseDate}>
            {!!installedVersionDate && (
              <>
                ({installedVersionDate})
                <Tooltip content={Messages.tooltip} data-testid="update-built-date-info">
                  <Icon name="info-circle" className={styles.infoIcon} />
                </Tooltip>
              </>
            )}
          </span>
        </span>
      </span>
    </section>
  );
};
