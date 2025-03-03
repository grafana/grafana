import { test, expect } from './fixtures';
import { ROUTES } from '../src/constants';

test.describe('navigating app', () => {
  test('page one should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.One}`);
    await expect(page.getByText('This is page one.')).toBeVisible();
  });

  test('page two should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Two}`);
    await expect(page.getByText('This is page two.')).toBeVisible();
  });

  test('page three should support an id parameter', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Three}/123456`);
    await expect(page.getByText('ID: 123456')).toBeVisible();
  });

  test('page three should render sucessfully', async ({ gotoPage, page }) => {
    // wait for page to successfully render
    await gotoPage(`/${ROUTES.One}`);
    await expect(page.getByText('This is page one.')).toBeVisible();

    // navigating to page four with full width layout without sidebar menu
    await page.getByText('Full-width page example').click();

    // navigate back to page one
    await page.getByRole('link', { name: 'Back', exact: true }).click();
  });
});
