import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { Text, Badge, Button, ClipboardButton, ConfirmModal, LoadingBar, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { AllowedDecrypter, DECRYPT_ALLOW_LIST_LABEL_MAP } from '../constants';
import { Secret } from '../types';
import { isSecretPending } from '../utils';

interface SecretItemProps {
  secret: Secret;
  onEditSecret: (name: string) => void;
  onDeleteSecret: (name: string) => void;
  key: React.Attributes['key']; // Needed for TypeScript (at least for me).
}

export function SecretItem({ secret, onEditSecret, onDeleteSecret }: SecretItemProps) {
  const styles = useStyles2(getStyles);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isPending = isSecretPending(secret);

  const handleEdit = () => {
    onEditSecret(secret.name);
  };

  const handleDelete = () => {
    onDeleteSecret(secret.name);
  };

  const handleShowDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleHideDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <li className={cx([styles.li, isPending && 'secret-pending'])}>
        {isPending && (
          <div className={styles.pendingBlanket}>
            <div className="secret-blanket-background" />
            <LoadingBar width={400} />
          </div>
        )}
        <div className={styles.headerContainer}>
          <Text element="h2" variant="h4">
            {secret.name}
          </Text>
          <div className={styles.headerActions}>
            <Button
              fill="outline"
              icon="edit"
              size="sm"
              onClick={handleEdit}
              variant="secondary"
              aria-label={t('secrets-management.item.edit-item-aria-label', `Edit {{name}}`, {
                name: secret.name,
              })}
            >
              <Trans i18nKey="secrets-management.item.edit-item">Edit</Trans>
            </Button>

            <Button
              icon="trash-alt"
              aria-label={t('secrets-management.item.delete-item-aria-label', `Delete {{name}}`, { name: secret.name })}
              size="sm"
              variant="secondary"
              onClick={handleShowDeleteModal}
            />
          </div>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets-management.item.labels.uid">ID:</Trans>
          </strong>
          <span>{secret.uid}</span>
          <ClipboardButton
            className={styles.copyButton}
            getText={() => secret.uid}
            size="sm"
            icon="copy"
            fill="text"
            variant="secondary"
            aria-label={t('secrets-management.item.copy-value-aria-label', 'Copy "{{value)}}"', {
              value: secret.uid,
            })}
          />
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets-management.item.labels.description">Description:</Trans>
          </strong>
          <span>{secret.description}</span>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets-management.item.labels.created">Created:</Trans>
          </strong>
          <span>{secret.created}</span>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets-management.item.labels.decrypters">Decrypters:</Trans>
          </strong>
          <div className={styles.row}>
            {secret.audiences?.map((item) => (
              <Badge
                className={styles.audienceBadge}
                color="blue"
                key={item}
                text={DECRYPT_ALLOW_LIST_LABEL_MAP[item as AllowedDecrypter] ?? item}
              />
            ))}
          </div>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets-management.item.labels.keeper">Keeper:</Trans>
          </strong>
          <span>{secret.keeper}</span>
        </div>
      </li>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onDismiss={handleHideDeleteModal}
        onConfirm={handleDelete}
        confirmText={t('secrets-management.item.delete-modal.delete-button', 'Delete')}
        confirmationText={t('secrets-management.item.delete-modal.confirm-text', 'Delete')}
        title={t('secrets-management.item.delete-modal.title', 'Delete secret')}
        body={t(
          'secrets-management.item.delete-modal.body',
          'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
          { name: secret.name }
        )}
        description={t(
          'secrets-management.item.delete-modal.description',
          "Before you delete this secret, make sure it's not being used by any service. Deleting this secret will not remove any references to it."
        )}
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
    position: 'relative',
    listStyle: 'none',
    backgroundColor: theme.colors.background.secondary,
    // color: theme.colors.text.secondary,
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
    padding: `0 ${theme.spacing(0.5)}`,
    '& > svg': {
      margin: '0',
    },
  }),
  pendingBlanket: css({
    position: 'absolute',
    display: 'flex',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 1,
    '& > .secret-blanket-background': {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      backgroundColor: theme.colors.background.secondary,
      opacity: 0.5,
      zIndex: 1,
    },
    '& > div': {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
    },
  }),
  keyValue: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    minHeight: '24px', // sm button height
    gap: theme.spacing(1),

    '& > strong': {
      color: theme.colors.text.primary,
    },
  }),
});
