import React, { FC } from 'react';

import { Button, Modal, TextLink, useStyles2 } from '@grafana/ui';
import { MigrationSummaryProps } from 'app/features/api-keys/ApiKeysPage';

import FailedMigrationRow from './FailedMigrationRow';
import { CONTACT_SUPPORT_LINK, SERVICE_ACCOUNTS_DOCS_LINK } from './MigrationSummary.constants';
import { Messages } from './MigrationSummary.messages';
import { getStyles } from './MigrationSummary.styles';

const MigrationSummary: FC<MigrationSummaryProps> = ({ visible, data, onDismiss }) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal
      title={Messages.title}
      isOpen={visible}
      closeOnBackdropClick={true}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <p>{Messages.description}</p>
      <strong>{Messages.failed(data.failed, data.total)}</strong>
      <div className={styles.list}>
        <ol>
          {data.failedApikeyIDs.map((id, idx) => (
            <FailedMigrationRow key={id} id={id} details={data.failedDetails[idx]} />
          ))}
        </ol>
      </div>
      <p>
        {Messages.needHelp}
        <TextLink href={SERVICE_ACCOUNTS_DOCS_LINK} external>
          {Messages.documentation}
        </TextLink>
        {Messages.or}
        <TextLink href={CONTACT_SUPPORT_LINK} external>
          {Messages.contactSupport}
        </TextLink>
        {Messages.dot}
      </p>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          {Messages.close}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export default MigrationSummary;
