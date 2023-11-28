import React, { FC } from 'react';

import { useStyles, Icon, LinkButton, Tooltip } from '@grafana/ui';

import { useToggleOnAltClick } from '../../hooks';
import { AvailableUpdateProps } from '../../types';

import { Messages } from './AvailableUpdate.messages';
import { getStyles } from './AvailableUpdate.styles';

export const AvailableUpdate: FC<AvailableUpdateProps> = ({ nextVersionDetails }) => {
  const styles = useStyles(getStyles);
  const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);

  const { nextVersionDate, nextVersion, nextFullVersion, newsLink } = nextVersionDetails;

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
          {showFullVersion ? nextFullVersion : nextVersion}
        </span>
        <span data-testid="update-latest-release-date" className={styles.releaseDate}>
          ({nextVersionDate})
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
