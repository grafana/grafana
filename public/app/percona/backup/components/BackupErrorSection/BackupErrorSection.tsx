import React, { FC } from 'react';

import { Card, useStyles } from '@grafana/ui';

import { Messages } from './BackupErrorSection.messages';
import { getStyles } from './BackupErrorSection.styles';
import { BackupErrorSectionProps } from './BackupErrorSection.types';

export const BackupErrorSection: FC<React.PropsWithChildren<BackupErrorSectionProps>> = ({ backupErrors = [] }) => {
  const styles = useStyles(getStyles);

  return (
    <Card heading={Messages.problemOcurred} className={styles.apiErrorCard}>
      <Card.Meta separator="">
        <section data-testid="backup-errors" className={styles.apiErrorSection}>
          {backupErrors.map((error) => (
            <div key={error.message} className={styles.errorLine}>
              <span className={styles.errorText}>{error.message} </span>
              {error.link && (
                <a href={error.link} className={styles.readMore} rel="noreferrer" target="_blank">
                  {Messages.readMore}
                </a>
              )}
            </div>
          ))}
        </section>
      </Card.Meta>
    </Card>
  );
};
