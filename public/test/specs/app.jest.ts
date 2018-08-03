import { GrafanaApp } from 'app/app';
jest.mock('app/routes/routes');

describe('GrafanaApp', () => {
  var app = new GrafanaApp();

  it('can call inits', () => {
    expect(app).not.toBe(null);
  });
});
