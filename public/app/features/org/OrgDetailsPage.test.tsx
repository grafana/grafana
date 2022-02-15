import React from 'react';
import 'whatwg-fetch';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import userEvent from '@testing-library/user-event';
import { setBackendSrv } from '@grafana/runtime';
import { render, screen, waitFor } from 'test/test-utils';
import { backendSrv } from 'app/core/services/backend_srv';
import OrgDetailsPage from './OrgDetailsPage';

const apiOrgPut: Parameters<typeof rest.put>[1] = jest.fn((_, res, ctx) => res(ctx.json('Organization updated')));

export const handlers = [
  rest.get('/api/org', (_, res, ctx) => res(ctx.json({ name: 'Test Org' }))),
  rest.put('/api/org', apiOrgPut),
  rest.get('/api/org/preferences', (_, res, ctx) => {
    return res(ctx.json({ homeDashboardId: 0, theme: 'dark', timezone: 'browser', weekStart: '' }));
  }),
  rest.get('/api/search', (_, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 105,
          uid: 'ciegr_Anz',
          title: '#43585 Dashboard with 6 prometheus variables',
          uri: 'db/43585-dashboard-with-6-prometheus-variables',
          url: '/d/ciegr_Anz/43585-dashboard-with-6-prometheus-variables',
          slug: '',
          type: 'dash-db',
          tags: [],
          isStarred: true,
          sortMeta: 0,
        },
      ])
    );
  }),
];

const server = setupServer(...handlers);
beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  // @ts-ignore
  setBackendSrv(undefined);
});

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
  };
});

describe('Render', () => {
  it('should render organization and preferences', async () => {
    render(<OrgDetailsPage />);

    const inputElement = await screen.findByLabelText('Organization name');
    expect(inputElement).toHaveValue('Test Org');
  });

  it('should update organization name', async () => {
    render(<OrgDetailsPage />);

    const inputElement = await screen.findByLabelText('Organization name');
    userEvent.clear(inputElement);
    userEvent.type(inputElement, 'New Org Name');
    const updateOrgNameButton = screen.getByText('Update organization name');
    userEvent.click(updateOrgNameButton);

    await waitFor(() => {
      expect(apiOrgPut).toBeCalledTimes(1);
      expect(apiOrgPut).toHaveBeenCalledWith(
        expect.objectContaining({ body: { name: 'New Org Name' } }),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
