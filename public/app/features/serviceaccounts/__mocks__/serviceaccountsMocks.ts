import { OrgRole, OrgServiceaccount } from 'app/types';

export const getMockserviceaccounts = (amount: number) => {
  const serviceaccounts = [];

  for (let i = 0; i <= amount; i++) {
    serviceaccounts.push({
      avatarUrl: 'url/to/avatar',
      email: `serviceaccount-${i}@test.com`,
      name: `serviceaccount-${i} test`,
      lastSeenAt: '2018-10-01',
      lastSeenAtAge: '',
      login: `serviceaccount-${i}`,
      userId: 1,
      orgId: 1,
      role: 'Admin',
      serviceaccountId: i,
    });
  }

  return serviceaccounts as OrgServiceaccount[];
};

export const getMockserviceaccount = () => {
  return {
    avatarUrl: 'url/to/avatar',
    email: `serviceaccount@test.com`,
    name: 'serviceaccount test',
    lastSeenAt: '2018-10-01',
    lastSeenAtAge: '',
    login: `serviceaccount`,
    userId: 1,
    orgId: 1,
    role: 'Admin' as OrgRole,
    serviceaccountId: 2,
  } as OrgServiceaccount;
};

export const getMockInvitees = (amount: number) => {
  const invitees = [];

  for (let i = 0; i <= amount; i++) {
    invitees.push({
      code: `asdfasdfsadf-${i}`,
      createdOn: '2018-10-02',
      email: `invitee-${i}@test.com`,
      emailSent: true,
      emailSentOn: '2018-10-02',
      id: i,
      invitedByEmail: 'admin@grafana.com',
      invitedByLogin: 'admin',
      invitedByName: 'admin',
      name: `invitee-${i}`,
      orgId: 1,
      role: 'viewer',
      status: 'not accepted',
      url: `localhost/invite/${i}`,
    });
  }

  return invitees;
};
