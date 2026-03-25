import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Modal, Button } from '@grafana/ui';

export interface SplashScreenModalProps {
  onDismiss: () => void;
}

export function SplashScreenModal({ onDismiss }: SplashScreenModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    onDismiss();
  };

  return (
    <Modal title={t('splash-screen.title', 'Welcome to Grafana')} isOpen={isOpen} onDismiss={handleDismiss}>
      <p>
        <Trans i18nKey="splash-screen.body">Splash screen content will go here.</Trans>
      </p>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={handleDismiss}>
          {t('splash-screen.get-started', 'Get started')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
