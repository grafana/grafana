export const getMockUsers = (amount: number) => {
  const users = [];

  for (let i = 0; i <= amount; i++) {
    users.push({
      avatarUrl: 'url/to/avatar',
      email: `user-${i}@test.com`,
      lastSeenAt: '2018-10-01',
      lastSeenAtAge: '',
      login: `user-${i}`,
      orgId: 1,
      role: 'Admin',
      userId: i,
    });
  }

  return users;
};

export const getMockUser = () => {
  return {
    avatarUrl: 'url/to/avatar',
    email: `user@test.com`,
    lastSeenAt: '2018-10-01',
    lastSeenAtAge: '',
    login: `user`,
    orgId: 1,
    role: 'Admin',
    userId: 2,
  };
};
