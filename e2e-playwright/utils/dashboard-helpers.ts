import { Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

/**
 * Add a new dashboard
 */
export async function addDashboard(page: Page, title?: string): Promise<string> {
  const dashboardTitle = title || `e2e-${uuidv4()}`;

  // Navigate to add dashboard page
  await page.goto('/dashboard/new');

  // Save the dashboard
  const saveButton = page.getByTestId('data-testid Save dashboard button');
  await saveButton.click();

  // Enter dashboard title
  const titleInput = page.getByLabel('Save dashboard title field');
  await titleInput.clear();
  await titleInput.fill(dashboardTitle);

  // Click save
  const saveAsButton = page.getByTestId('data-testid Save dashboard drawer button');
  await saveAsButton.click();

  // Wait for success notification
  await expect(page.getByText('Dashboard saved')).toBeVisible();

  // Get the dashboard UID from the URL
  const url = page.url();
  const uidMatch = url.match(/\/d\/([^\/\?]+)/);
  const uid = uidMatch ? uidMatch[1] : '';

  return uid;
}
