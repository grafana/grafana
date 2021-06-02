import { NotificationChannel } from '../NotificationChannel.types';
import { notificationChannelStubs } from './notificationChannelStubs';

export const NotificationChannelService = {
  async list(): Promise<NotificationChannel[]> {
    return notificationChannelStubs;
  },
  async add(): Promise<void> {
    return Promise.resolve();
  },
  async remove(): Promise<void> {
    return Promise.resolve();
  },
};
