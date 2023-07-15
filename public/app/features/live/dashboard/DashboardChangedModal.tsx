import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Modal, stylesFactory, useStyles2 } from '@grafana/ui';

import { dashboardWatcher } from './dashboardWatcher';
import { DashboardEvent, DashboardEventAction } from './types';

interface Props {
  event?: DashboardEvent;
  onDismiss: () => void;
}

export function DashboardChangedModal({ onDismiss, event }: Props) {
  const styles = useStyles2(getStyles);

  const onDiscardChanges = () => {
    if (event?.action === DashboardEventAction.Deleted) {
      locationService.push('/');
      return;
    }

    dashboardWatcher.reloadPage();
    onDismiss();
  };

  return (
    <Modal
      isOpen={true}
      title="Dashboard changed"
      icon="copy"
      onDismiss={onDismiss}
      onClickBackdrop={() => {}}
      className={styles.modal}
    >
      <div className={styles.description}>
        The dashboad has been updated by another session. Do you want to continue editing or discard your local changes?
      </div>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary" fill="outline">
          Continue editing
        </Button>
        <Button onClick={onDiscardChanges} variant="destructive">
          Discard local changes
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    modal: css({ width: '600px' }),
    description: css({
      color: theme.colors.text.secondary,
      paddingBottom: theme.spacing(1),
    }),
  };
});
