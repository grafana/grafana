import { type APIRequestContext } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

export async function deleteUser(request: APIRequestContext, userId: number): Promise<void> {
  const response = await request.delete(`/api/admin/users/${userId}`);
  expect(
    response.ok(),
    `DELETE /api/admin/users/${userId} -> ${response.status()} ${await response.text()}`
  ).toBeTruthy();
}
