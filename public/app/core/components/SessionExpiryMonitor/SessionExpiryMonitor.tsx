import { useEffect, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { getSessionExpiry, hasSessionExpiry } from 'app/core/utils/auth';

interface SessionExpiryMonitorProps {
  warningMinutes?: number; // Minutes before expiry to show warning
  checkIntervalMs?: number; // How often to check session expiry
}

export function SessionExpiryMonitor({ 
  warningMinutes = 5, 
  checkIntervalMs = 30000 // Check every 30 seconds
}: SessionExpiryMonitorProps) {
  const notifyApp = useAppNotification();
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastExpiryTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Only monitor if user is signed in and session expiry is available
    if (!contextSrv.isSignedIn || !hasSessionExpiry()) {
      return;
    }

    const checkSessionExpiry = () => {
      const expiryTimestamp = getSessionExpiry();
      if (!expiryTimestamp) {
        return;
      }

      const now = Date.now();
      const expiryTime = expiryTimestamp * 1000;
      const sessionTimeRemainingMs = expiryTime - now;
      const sessionTimeRemainingMinutes = sessionTimeRemainingMs / (60 * 1000);

      // Dynamic warning time: Use the smaller of warningMinutes or half the remaining session time
      // This prevents showing warnings immediately for short sessions
      const effectiveWarningMinutes = Math.min(
        warningMinutes, 
        Math.max(1, sessionTimeRemainingMinutes / 2) // At least 1 minute, at most half remaining time
      );
      
      const warningTime = expiryTime - (effectiveWarningMinutes * 60 * 1000);

      // Reset warning flag if session is renewed (expiry time changed)
      if (lastExpiryTimeRef.current && lastExpiryTimeRef.current !== expiryTime) {
        setHasShownWarning(false);
        lastExpiryTimeRef.current = expiryTime;
      } else if (!lastExpiryTimeRef.current) {
        lastExpiryTimeRef.current = expiryTime;
      }

      // Show warning if we've reached the warning threshold and haven't shown it yet
      // Also ensure we have at least 30 seconds remaining to avoid showing warning too late
      if (now >= warningTime && sessionTimeRemainingMs > 30000 && !hasShownWarning) {
        const remainingMinutes = Math.ceil(sessionTimeRemainingMs / (60 * 1000));
        
        try {
          notifyApp.warning(
            t('session-expiry.warning-title', 'Session Expiring Soon'),
            t('session-expiry.warning-message', 
              'Your session will expire in {{minutes}} minute(s). Please make sure to finish up or save any changes.',
              { minutes: remainingMinutes }
            )
          );
          
          setHasShownWarning(true);
        } catch (error) {
          console.error('Error showing session expiry notification:', error);
        }
      }
    };

    checkSessionExpiry();

    intervalRef.current = setInterval(checkSessionExpiry, checkIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [warningMinutes, checkIntervalMs, notifyApp, hasShownWarning]);

  return null;
}
