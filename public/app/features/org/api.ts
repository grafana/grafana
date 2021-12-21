import { getBackendSrv, locationService } from '@grafana/runtime';
import { FormModel } from './UserInviteForm';

export const userInviteSubmit = async (formData: FormModel) => {
  await getBackendSrv().post('/api/org/invites', formData);
  locationService.push('/org/users/');
};
