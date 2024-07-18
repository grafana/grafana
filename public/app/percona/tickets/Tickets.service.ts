import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { Ticket, TicketResponse } from './Tickets.types';

const BASE_URL = '/v1/platform';

export const TicketsService = {
  async list(token?: CancelToken): Promise<Ticket[]> {
    const { tickets = [] } = await api.post<TicketResponse, {}>(
      `${BASE_URL}/SearchOrganizationTickets`,
      {},
      false,
      token
    );
    return tickets.map(
      ({ number, short_description, priority, state, create_time, department, task_type, url }): Ticket => ({
        number,
        shortDescription: short_description,
        priority,
        state,
        createTime: new Date(create_time).toLocaleDateString('en-GB'),
        department,
        taskType: task_type,
        url,
      })
    );
  },
};
