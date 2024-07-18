import { api } from '../../helpers/api';

import { ActionRequest, ActionResponse } from './Actions.types';

export const ActionsService = {
  getActionResult<T>(body: ActionRequest) {
    return api.get<ActionResponse<T>, ActionRequest>(`/v1/actions/${body.action_id}`);
  },
};
