import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { Trans, t } from '@grafana/i18n';
import { Text, Badge, Button, ClipboardButton, ConfirmModal, LoadingBar, useStyles2, Tag } from '@grafana/ui';

import { DECRYPT_ALLOW_LIST_LABEL_MAP } from '../constants';
import { Secret } from '../types';
import { isSecretPending } from '../utils';

interface SecretItemProps {
  secret: Secret;
  onEditSecret: (name: string) => void;
  onDeleteSecret: (name: string) => void;
}

export function SecretItem({ secret, onEditSecret, onDeleteSecret }: SecretItemProps) {
  const styles = useStyles2(getStyles);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isPending = isSecretPending(secret);
  const hasLabels = secret.labels.length > 0;
  const hasKeeper = !!secret.keeper;
  const [isHeadingWrapped, setIsHeadingWrapped] = useState(!hasLabels);
  const itemRef = useRef<HTMLDivElement>(null);
  const debouncedResizeHandler = useMemo(() => {
    return debounce(
      () => {
        const { height } = itemRef?.current?.getBoundingClientRect() ?? { height: 0 };
        // inline is 26px, and wrapped is 62px+ (39px is in the middle of the two states).
        // if there are no labels, we need to pretend that we are in a wrapped state to push the margin onto the name
        setIsHeadingWrapped(height > 39 || !hasLabels);
      },
      150,
      { maxWait: 500 }
    );
  }, [hasLabels]);

  useEffect(() => {
    const handler = () => {
      debouncedResizeHandler();
    };
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [debouncedResizeHandler]);

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
        <div ref={itemRef} className={cx([styles.headerContainer, isHeadingWrapped && 'wrapped'])}>
          <Text element="h2" variant="h4">
            {secret.name}
          </Text>
          <div className={styles.tagsContainer}>
            {secret.labels?.map((label) => (
              <Tag key={label.name} colorIndex={3} name={`${label.name}: ${label.value}`} />
            ))}
          </div>
          <div className={styles.headerActions}>
            <Button
              fill="outline"
              icon="edit"
              size="sm"
              onClick={handleEdit}
              variant="secondary"
              aria-label={t('secrets.item.edit-item-aria-label', `Edit {{name}}`, {
                name: secret.name,
              })}
            >
              <Trans i18nKey="secrets.item.edit-item">Edit</Trans>
            </Button>

            <Button
              icon="trash-alt"
              aria-label={t('secrets.item.delete-item-aria-label', `Delete {{name}}`, { name: secret.name })}
              size="sm"
              variant="secondary"
              onClick={handleShowDeleteModal}
            />
          </div>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets.item.label-uid">ID:</Trans>
          </strong>
          <span>{secret.uid}</span>
          <ClipboardButton
            className={styles.copyButton}
            getText={() => secret.uid}
            size="sm"
            icon="copy"
            fill="text"
            variant="secondary"
            aria-label={t('secrets.item.copy-value-aria-label', 'Copy "{{value}}"', {
              value: secret.uid,
            })}
          />
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets.item.label-description">Description:</Trans>
          </strong>
          <span>{secret.description}</span>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets.item.label-created">Created:</Trans>
          </strong>
          <span>{secret.created}</span>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets.item.label-modified">Modified:</Trans>
          </strong>
          <span>{secret.modified}</span>
        </div>

        <div className={styles.keyValue}>
          <strong>
            <Trans i18nKey="secrets.item.label-decrypters">Decrypters:</Trans>
          </strong>
          <div className={styles.row}>
            {secret.decrypters?.map((item) => {
              return (
                <Badge
                  className={styles.audienceBadge}
                  color="blue"
                  key={item}
                  text={DECRYPT_ALLOW_LIST_LABEL_MAP[item] ?? item}
                />
              );
            })}
          </div>
        </div>

        {hasKeeper && (
          <div className={styles.keyValue}>
            <Trans i18nKey="secrets.item.label-keeper" values={{ keeper: secret.keeper }}>
              <strong>Keeper:</strong>
              <span>{'{{keeper}}'}</span>
            </Trans>
          </div>
        )}
      </li>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onDismiss={handleHideDeleteModal}
        onConfirm={handleDelete}
        confirmText={t('secrets.item.delete-modal.delete-button', 'Delete')}
        confirmationText={t('secrets.item.delete-modal.confirm-text', 'delete')}
        title={t('secrets.item.delete-modal.title', 'Delete secret')}
        body={t(
          'secrets.item.delete-modal.body',
          'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
          { name: secret.name }
        )}
        description={t(
          'secrets.item.delete-modal.description',
          "Before you delete this secret, make sure it's not being used by any service. Deleting this secret will not remove any references to it."
        )}
      />
    </>
  );
}

const ACTIONS_MARGIN = '108px'; // actions width + gap

const getStyles = (theme: GrafanaTheme2) => ({
  // Copy/paste from access-policies
  audienceBadge: css({
    backgroundColor: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.primary,
  }),
  headerContainer: css({
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    marginBottom: theme.spacing(2),
    minHeight: '24px', // height of actions (else they may be cut-off)s
    '&.wrapped > h2': {
      wordBreak: 'break-word',
      marginRight: ACTIONS_MARGIN,
    },
    overflow: 'hidden',
  }),
  headerActions: css({
    display: 'flex',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary, // for when toggling .wrapped
    position: 'absolute',
    right: 0,
    top: 0,
  }),
  li: css({
    position: 'relative',
    listStyle: 'none',
    backgroundColor: theme.colors.background.secondary,
    fontSize: theme.typography.body.fontSize,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    overflow: 'auto',
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
  tagsContainer: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    flex: '1 1 auto',
    marginRight: ACTIONS_MARGIN,
    flexWrap: 'wrap',
    '& > *': {
      wordBreak: 'break-word',
    },
    '.wrapped &': {
      marginRight: 0,
    },
  }),
});
