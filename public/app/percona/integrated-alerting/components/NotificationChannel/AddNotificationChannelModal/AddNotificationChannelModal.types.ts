import { NotificationChannel } from '../NotificationChannel.types';

export interface AddNotificationChannelModalProps {
  isVisible: boolean;
  notificationChannel?: NotificationChannel;
  setVisible: (value: boolean) => void;
}
