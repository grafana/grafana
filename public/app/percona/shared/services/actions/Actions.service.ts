import { apiManagement } from '../../helpers/api';

import { ActionRequest, ActionResponse } from './Actions.types';

export const ActionsService = {
  getActionResult<T>(body: ActionRequest) {
    return apiManagement.post<ActionResponse<T>, ActionRequest>('/Actions/Get', body);
  },
};
