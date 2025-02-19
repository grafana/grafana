import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { Badge, ClipboardButton, ConfirmModal, InlineField, InlineFieldRow } from '@grafana/ui';
import { Button, useStyles2 } from '@grafana/ui/';
import { useDispatch } from 'app/types';

import { deleteSecret } from '../state/actions';
import { Secret } from '../types';

interface SecretItemProps {
  secret: Secret;
  onEditSecret: (name: string) => void;
  key: React.Attributes['key']; // Needed for typescript (at least for me).
}

export function SecretItem({ secret, onEditSecret }: SecretItemProps) {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEdit = () => {
    onEditSecret(secret.name);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleEdit();
    }
  };

  const handleDelete = () => {
    dispatch(deleteSecret(secret.name));
  };

  const handleShowDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleHideDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <li className={styles.li} tabIndex={0} onKeyUp={handleKeyUp}>
        <div className={styles.headerContainer}>
          <h2 className={styles.heading}>{secret.name}</h2>
          <div className={styles.headerActions}>
            <Button fill="outline" icon="edit" size="sm" onClick={handleEdit} variant="secondary">
              Edit
            </Button>
            <Button fill="outline" icon="trash-alt" size="sm" variant="secondary" onClick={handleShowDeleteModal} />
          </div>
        </div>
        <InlineFieldRow className={styles.inlineField}>
          <InlineField label="Name:">
            <div>
              {secret.name}
              <ClipboardButton
                className={styles.copyButton}
                getText={() => secret.name}
                size="sm"
                icon="copy"
                fill="text"
                variant="secondary"
              />
            </div>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow className={styles.inlineField}>
          <InlineField label="ID:">
            <div>
              {secret.uid}
              <ClipboardButton
                className={styles.copyButton}
                getText={() => secret.uid}
                size="sm"
                icon="copy"
                fill="text"
                variant="secondary"
              />
            </div>
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow className={styles.inlineField}>
          <InlineField label="Description:">
            <div>{secret.description}</div>
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow className={styles.inlineField}>
          <InlineField label="Decrypters:">
            <div className={styles.row}>
              {secret.audiences?.map((item) => (
                <Badge className={styles.audienceBadge} color="blue" key={item} text={item} />
              ))}
            </div>
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow className={styles.inlineField}>
          <InlineField label="Keeper:">
            <div>{secret.keeper}</div>
          </InlineField>
        </InlineFieldRow>
      </li>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onDismiss={handleHideDeleteModal}
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmationText="Delete"
        title="Delete secret"
        body={`Are you sure you want to delete '${secret.name}'?`}
        description="Before you delete this secret, make sure it's not being used by any service. Deleting this secret will not remove any references to it."
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Copy/paste from access-policies
  audienceBadge: css({
    backgroundColor: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.primary,
  }),
  headerContainer: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  }),
  headerActions: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
  li: css({
    listStyle: 'none',
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
  heading: css({
    color: theme.colors.text.maxContrast,
    fontSize: theme.typography.h4.fontSize,
    margin: 0,
  }),
  row: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(0.5),
  }),
  inlineField: css({
    '& > div > label': {
      minWidth: '80px',
      backgroundColor: 'transparent',
      paddingLeft: 0,
      maxHeight: '15px',
    },
    '& > div': {
      alignItems: 'center',
    },
  }),
  copyButton: css({
    marginLeft: theme.spacing(1),
    padding: `0 ${theme.spacing(0.5)}`,
    '& > svg': {
      margin: '0',
    },
  }),
});
