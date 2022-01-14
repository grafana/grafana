import { api } from 'app/percona/shared/helpers/api';
import {
  NotificationChannel,
  NotificationChannelListResponse,
  NotificationChannelRenderProps,
} from './NotificationChannel.types';
import { TO_MODEL, TO_API, getType } from './NotificationChannel.utils';

const BASE_URL = `/v1/management/ia/Channels`;

export const NotificationChannelService = {
  // TODO pageIndex and pageSize should be sent to the API
  // Also, totalPages and totalItems should be returned
  async list(): Promise<NotificationChannel[]> {
    return api
      .post(`${BASE_URL}/List`, {})
      .then(({ channels }: NotificationChannelListResponse) =>
        channels ? channels.map((channel) => TO_MODEL[getType(channel)](channel)) : []
      );
  },
  async add(values: NotificationChannelRenderProps): Promise<void> {
    return api.post(`${BASE_URL}/Add`, values.type?.value && TO_API[values.type.value](values));
  },
  async change(channelId: string, values: NotificationChannelRenderProps): Promise<void> {
    return api.post(`${BASE_URL}/Change`, {
      channel_id: channelId,
      ...(values.type?.value ? TO_API[values.type.value](values) : {}),
    });
  },
  async remove({ channelId }: NotificationChannel): Promise<void> {
    return api.post(`${BASE_URL}/Remove`, { channel_id: channelId });
  },
};
