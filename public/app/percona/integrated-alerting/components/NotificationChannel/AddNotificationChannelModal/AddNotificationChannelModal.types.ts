import { NotificationChannel } from '../NotificationChannel.types';

export interface AddNotificationChannelModalProps {
  isVisible: boolean;
  notificationChannel?: NotificationChannel | null;
  setVisible: (value: boolean) => void;
}
