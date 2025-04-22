import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Modal, Icon, Button, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { type CardGridItem } from '../CardGrid';

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '500px',
  }),
  modalContent: css({
    overflow: 'visible',
    color: theme.colors.text.secondary,

    a: {
      color: theme.colors.text.link,
    },
  }),
  description: css({
    marginBottom: theme.spacing(2),
  }),
  bottomSection: css({
    display: 'flex',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(3),
    marginTop: theme.spacing(3),
  }),
  actionsSection: css({
    display: 'flex',
    justifyContent: 'end',
    marginTop: theme.spacing(3),
  }),
  warningIcon: css({
    color: theme.colors.warning.main,
    paddingRight: theme.spacing(),
    marginTop: theme.spacing(0.25),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
  }),
  headerTitle: css({
    margin: 0,
  }),
  headerLogo: css({
    marginRight: theme.spacing(2),
    width: '32px',
    height: '32px',
  }),
});

export type NoAccessModalProps = {
  item: CardGridItem;
  isOpen: boolean;
  onDismiss: () => void;
};

export function NoAccessModal({ item, isOpen, onDismiss }: NoAccessModalProps) {
  const styles = useStyles2(getStyles);

  return (
    <Modal
      className={styles.modal}
      contentClassName={styles.modalContent}
      title={<NoAccessModalHeader item={item} />}
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      <div>
        <div>
          {item.description && <div className={styles.description}>{item.description}</div>}
          <div>
            <Trans i18nKey="connections.no-access-modal.links">Links</Trans>
            <br />
            <TextLink href={`https://grafana.com/grafana/plugins/${item.id}`} external>
              {item.name}
            </TextLink>
          </div>
        </div>
        <div className={styles.bottomSection}>
          <div className={styles.warningIcon}>
            <Icon name="exclamation-triangle" />
          </div>
          <div>
            <p>
              <Trans i18nKey="connections.no-access-modal.editor-warning">
                Editors cannot add new connections. You may check to see if it is already configured in{' '}
                <a href="/connections/datasources">Data sources</a>.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="connections.no-access-modal.connection-contact-grafana-admin">
                To add a new connection, contact your Grafana admin.
              </Trans>
            </p>
          </div>
        </div>
        <div className={styles.actionsSection}>
          <Button onClick={onDismiss}>
            <Trans i18nKey="connections.no-access-modal.okay">Okay</Trans>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function NoAccessModalHeader({ item }: { item: CardGridItem }) {
  const styles = useStyles2(getStyles);
  return (
    <div>
      <div className={styles.header}>
        {item.logo && <img className={styles.headerLogo} src={item.logo} alt={`logo of ${item.name}`} />}
        <h4 className={styles.headerTitle}>{item.name}</h4>
      </div>
    </div>
  );
}
