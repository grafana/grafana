import React from 'react';

import { Modal, VerticalGroup } from '@grafana/ui';

export interface AlertHowToModalProps {
  onDismiss: () => void;
}

export function AlertHowToModal({ onDismiss }: AlertHowToModalProps): JSX.Element {
  return (
    <Modal title="Adding an Alert" isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
      <VerticalGroup spacing="sm">
        <img src="public/img/alert_howto_new.png" alt="" />
        <p>
          Alerts are added and configured in the Alert tab of any dashboard graph panel, letting you build and visualize
          an alert using existing queries.
        </p>
        <p>Remember to save the dashboard to persist your alert rule changes.</p>
      </VerticalGroup>
    </Modal>
  );
}
