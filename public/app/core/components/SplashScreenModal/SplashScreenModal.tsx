import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, IconButton } from '@grafana/ui';
import { ModalBase } from '@grafana/ui/internal';

export function SplashScreenModal() {
  const isSplashScreenEnabled = useBooleanFlagValue('splashScreen', false);
  const [isOpen, setIsOpen] = useState(true);

  if (!isSplashScreenEnabled || !isOpen) {
    return null;
  }

  const handleDismiss = () => setIsOpen(false);

  return (
    <ModalBase isOpen onDismiss={handleDismiss} aria-label={t('splash-screen.title', 'Welcome to Grafana')}>
      <IconButton name="times" size="xl" onClick={handleDismiss} aria-label={t('splash-screen.close', 'Close')} />
      <p>{t('splash-screen.body', 'Splash screen content will go here.')}</p>
      <Button variant="primary" onClick={handleDismiss}>
        {t('splash-screen.get-started', 'Get started')}
      </Button>
    </ModalBase>
  );
}
