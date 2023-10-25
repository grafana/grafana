import React from 'react';

import { Modal, Button } from '@grafana/ui';

type Props = {
    onDismiss: () => void;
    isOpen: boolean;
}

export const InstallInfoModal = ({onDismiss, isOpen}: Props) => (
    <Modal title={'Please acknowledge'} isOpen={isOpen} onDismiss={onDismiss}>
        <div>
        {
            'Please note that installation can take a while. It can take from 30 sec to 5 minutes for the plugin to appear in the list.'
        }
        </div>
        <Modal.ButtonRow>
        <Button variant="primary" onClick={onDismiss}>
            OK
        </Button>
        </Modal.ButtonRow>
    </Modal>
);
