import { NotificationChannel } from '../NotificationChannel.types';

export interface DeleteNotificationChannelModalProps {
  isVisible: boolean;
  notificationChannel: NotificationChannel;
  setVisible: (value: boolean) => void;
}
