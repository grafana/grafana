import React, { FC } from 'react';

import { Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';

import { formatDateWithYear } from '../../UpdatePanel.utils';
import { useToggleOnAltClick } from '../../hooks';

import { Messages } from './AvailableUpdate.messages';
import { getStyles } from './AvailableUpdate.styles';
import { AvailableUpdateProps } from './AvailableUpdate.types';

export const AvailableUpdate: FC<AvailableUpdateProps> = ({ nextVersion, newsLink }) => {
  const styles = useStyles2(getStyles);
  const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <section
      data-testid="update-latest-section"
      className={styles.availableUpdate}
      onClick={handleToggleShowFullVersion}
    >
      <span>
        {Messages.availableVersion}
        :&nbsp;
        <span data-testid="update-latest-version" className={styles.latestVersion}>
          {showFullVersion ? nextVersion?.tag : nextVersion?.version}
        </span>
        <span data-testid="update-latest-release-date" className={styles.releaseDate}>
          {!!nextVersion?.timestamp && `(${formatDateWithYear(nextVersion?.timestamp)})`}
          <Tooltip content={Messages.tooltip} data-testid="update-published-date-info">
            <Icon name="info-circle" className={styles.infoIcon} />
          </Tooltip>
        </span>
        {newsLink && (
          <LinkButton
            data-testid="update-news-link"
            className={styles.whatsNewLink}
            rel="noreferrer"
            href={newsLink}
            target="_blank"
            fill="text"
          >
            {Messages.whatsNew}
          </LinkButton>
        )}
      </span>
    </section>
  );
};
