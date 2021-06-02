import { NotificationChannelList } from '../NotificationChannel.types';
import { notificationChannelStubs } from './notificationChannelStubs';

export const NotificationChannelService = {
  async list(): Promise<NotificationChannelList> {
    return {
      channels: notificationChannelStubs,
      totals: {
        total_pages: 1,
        total_items: notificationChannelStubs.length,
      },
    };
  },
  async add(): Promise<void> {
    return Promise.resolve();
  },
  async remove(): Promise<void> {
    return Promise.resolve();
  },
  async change(): Promise<void> {
    return Promise.resolve();
  },
};
