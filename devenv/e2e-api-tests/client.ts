const axios = require('axios');

export function getClient(options) {
  return axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 1000,
    auth: {
      username: options.username,
      password: options.password,
    },
  });
}

export function getAdminClient() {
  return getClient({
    username: 'admin',
    password: 'admin',
  });
}

let client = getAdminClient();

client.callAs = function(user) {
  return getClient({
    username: user.login,
    password: 'password',
  });
};

export default client;
