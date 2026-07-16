import { HttpResponse, http, type HttpResponseResolver } from 'msw';

const LOGIN_URL = '/login';

const loginHandler = () =>
  http.post(LOGIN_URL, async () => {
    return HttpResponse.json({ message: 'Logged in' });
  });

const signupHandler = () =>
  http.post('/api/user/signup', async () => {
    return HttpResponse.json({ message: 'SignUpCreated' });
  });

const signupStep2Handler = () =>
  http.post('/api/user/signup/step2', async () => {
    return HttpResponse.json({ message: 'Logged in' });
  });

const resetPasswordHandler = () =>
  http.post('/api/user/password/reset', async () => {
    return HttpResponse.json({ message: 'User updated' });
  });

const sendResetEmailHandler = () =>
  http.post('/api/user/password/send-reset-email', async () => {
    return HttpResponse.json({ message: 'Email sent' });
  });

export const customLoginHandler = (resolver: HttpResponseResolver) => http.post(LOGIN_URL, resolver);

const handlers = [
  loginHandler(),
  signupHandler(),
  signupStep2Handler(),
  resetPasswordHandler(),
  sendResetEmailHandler(),
];

export default handlers;
