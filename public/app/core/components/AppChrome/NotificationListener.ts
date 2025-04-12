import { useEffect } from 'react';

import { LiveChannelAddress, LiveChannelScope } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';

interface Notification {
  type: string;
  message: string;
  // Add other fields based on your notification structure
}

export const useNotificationService = () => {
  useEffect(() => {
    const live = getGrafanaLiveSrv();

    const channel: LiveChannelAddress = {
      scope: LiveChannelScope.Grafana,
      namespace: 'broadcast',
      path: 'notify'
    };

    const subscription = live.getStream<Notification>(channel).subscribe({
      next: (event) => {
        if (event.type === 'message') {
          // Handle different notification types
          switch (event.message.type) {
            case 'success':
              // Handle success notification
              console.log('Success:', event.message.message);
              break;
            case 'error':
              // Handle error notification
              console.error('Error:', event.message.message);
              break;
            case 'warning':
              // Handle warning notification
              console.warn('Warning:', event.message.message);
              break;
            default:
              console.log('Notification:', event.message);
          }
        }
      },
      error: (error) => {
        console.error('Error in notification stream:', error);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null; // Or render something if needed
};
