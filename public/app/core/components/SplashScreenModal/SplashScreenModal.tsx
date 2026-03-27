import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Modal, Button } from '@grafana/ui';

export function SplashScreenModal() {
  const isSplashScreenEnabled = useBooleanFlagValue('splashScreen', false);
  const [isOpen, setIsOpen] = useState(true);

  if (!isSplashScreenEnabled || !isOpen) {
    return null;
  }

  return (
    <Modal title={t('splash-screen.title', 'Welcome to Grafana')} isOpen onDismiss={() => setIsOpen(false)}>
      <p>{t('splash-screen.body', 'Splash screen content will go here.')}</p>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={() => setIsOpen(false)}>
          {t('splash-screen.get-started', 'Get started')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
