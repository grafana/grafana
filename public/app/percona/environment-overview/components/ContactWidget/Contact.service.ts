import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { CustomerSuccess, CustomerSuccessResponse } from './Contact.types';

const BASE_URL = '/v1/Platform';

export const ContactService = {
  async getContact(token?: CancelToken): Promise<CustomerSuccess> {
    const {
      customer_success: { name, email },
      new_ticket_url,
    } = await api.post<CustomerSuccessResponse, {}>(`${BASE_URL}/GetContactInformation`, {}, false, token);
    return { name, email, newTicketUrl: new_ticket_url };
  },
};
