import React, { FC } from 'react';

import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { formatDateWithYear } from '../../UpdatePanel.utils';
import { useToggleOnAltClick } from '../../hooks';

import { Messages } from './CurrentVersion.messages';
import { getStyles } from './CurrentVersion.styles';
import { CurrentVersionProps } from './CurrentVersion.types';

export const CurrentVersion: FC<CurrentVersionProps> = ({ currentVersion }) => {
  const styles = useStyles2(getStyles);
  const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);

  return (
    <section className={styles.currentVersion}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span onClick={handleToggleShowFullVersion}>
        {Messages.currentVersion}:&nbsp;
        <span>
          <span data-testid="update-installed-version">
            {showFullVersion ? currentVersion.fullVersion : currentVersion.version}
          </span>
          &nbsp;
          <span data-testid="update-installed-release-date" className={styles.releaseDate}>
            {!!currentVersion.timestamp && (
              <>
                ({formatDateWithYear(currentVersion.timestamp)})
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
