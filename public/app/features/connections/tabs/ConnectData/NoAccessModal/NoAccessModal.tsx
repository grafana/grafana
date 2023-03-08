import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Modal, Icon, Button } from '@grafana/ui';

import { type CardGridItem } from '../CardGrid';

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 500px;
  `,
  modalContent: css`
    overflow: visible;
    color: ${theme.colors.text.secondary};

    a {
      color: ${theme.colors.text.link};
    }
  `,
  description: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  bottomSection: css`
    display: flex;
    border-top: 1px solid ${theme.colors.border.weak};
    padding-top: ${theme.spacing(3)};
    margin-top: ${theme.spacing(3)};
  `,
  actionsSection: css`
    display: flex;
    justify-content: end;
    margin-top: ${theme.spacing(3)};
  `,
  warningIcon: css`
    color: ${theme.colors.warning.main};
    padding-right: ${theme.spacing()};
    margin-top: ${theme.spacing(0.25)};
  `,
  header: css`
    display: flex;
    align-items: center;
  `,
  headerTitle: css`
    margin: 0;
  `,
  headerLogo: css`
    margin-right: ${theme.spacing(2)};
    width: 32px;
    height: 32px;
  `,
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
            Links
            <br />
            <a
              href={`https://grafana.com/grafana/plugins/${item.id}`}
              title={`${item.name} on Grafana.com`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.name}
            </a>
          </div>
        </div>
        <div className={styles.bottomSection}>
          <div className={styles.warningIcon}>
            <Icon name="exclamation-triangle" />
          </div>
          <div>
            <p>
              Editors cannot add new connections. You may check to see if it is already configured in{' '}
              <a href="/connections/your-connections">Your Connections</a>.
            </p>
            <p>To add a new connection, contact your Grafana admin.</p>
          </div>
        </div>
        <div className={styles.actionsSection}>
          <Button onClick={onDismiss}>Okay</Button>
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
