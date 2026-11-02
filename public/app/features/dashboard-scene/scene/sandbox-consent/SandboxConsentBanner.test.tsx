import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

import { SandboxConsentBanner } from './SandboxConsentBanner';
import { clearBlocked, getAllowedOrigins, reportBlocked } from './sandboxConsent';

const twimg = 'https://pbs.twimg.com';
const dicebear = 'https://api.dicebear.com';

let dashboardUid = '';
let uidCounter = 0;

function reportMockupPanels() {
  act(() => {
    reportBlocked('text-sample', {
      dashboardUid,
      panelId: 1,
      panelTitle: 'Text sample',
      origins: [{ origin: twimg, urls: [{ url: `${twimg}/media/a.jpg`, count: 5 }] }],
    });
    reportBlocked('mixed', {
      dashboardUid,
      panelId: 2,
      panelTitle: 'Mixed image sources',
      origins: [
        {
          origin: dicebear,
          urls: [
            { url: `${dicebear}/svg?seed=j.smith`, count: 1 },
            { url: `${dicebear}/svg?seed=j.johnson`, count: 1 },
            { url: `${dicebear}/svg?seed=w.zhang`, count: 1 },
          ],
        },
      ],
    });
  });
}

async function openReview() {
  await userEvent.click(screen.getByRole('button', { name: 'Review' }));
  return screen.getByRole('dialog');
}

beforeEach(() => {
  dashboardUid = `dash-${uidCounter++}`;
});

afterEach(() => {
  clearBlocked('text-sample');
  clearBlocked('mixed');
  clearBlocked('late');
  window.localStorage.clear();
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});

it('summarises blocked sources and resources across panels', () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  expect(screen.getByText('8 resources from 2 sources are blocked')).toBeVisible();
});

it('renders nothing for a dashboard without blocked sources', () => {
  reportMockupPanels();
  render(<SandboxConsentBanner dashboardUid="another-dashboard" />);
  expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
});

it('lists each host with its panels and every blocked URL', async () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  const [twimgRow, dicebearRow] = within(dialog).getAllByRole('listitem');

  expect(within(twimgRow).getByText('pbs.twimg.com')).toBeVisible();
  expect(within(twimgRow).getByText('Text sample')).toBeVisible();
  expect(within(twimgRow).getByText('5 resources from 1 URL')).toBeVisible();
  expect(within(twimgRow).getByText('×5')).toBeVisible();

  expect(within(dicebearRow).getByText('Mixed image sources')).toBeVisible();
  expect(within(dicebearRow).getByText('3 resources')).toBeVisible();
  expect(within(dicebearRow).queryByText(/^×/)).not.toBeInTheDocument();
  for (const seed of ['j.smith', 'j.johnson', 'w.zhang']) {
    expect(within(dicebearRow).getByText(`${dicebear}/svg?seed=${seed}`)).toBeVisible();
  }
});

it("doesn't let a source be allowed when some of its URLs couldn't be listed", async () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  act(() => {
    reportBlocked('text-sample', {
      dashboardUid,
      panelTitle: 'Leaky',
      origins: [{ origin: twimg, urls: [{ url: `${twimg}/collect?d=abc`, count: 1 }], truncated: true }],
    });
  });
  expect(screen.getByText('4+ resources from 2 sources are blocked')).toBeVisible();
  const dialog = await openReview();
  expect(within(dialog).getByText('1+ resource')).toBeVisible();
  expect(within(dialog).getByText("Too many resources to review. This source can't be allowed.")).toBeVisible();
  expect(within(dialog).getByRole('checkbox', { name: 'pbs.twimg.com' })).toBeDisabled();

  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Select all' }));
  expect(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'pbs.twimg.com' })).not.toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'Select all' })).toBeChecked();
});

it('enables the actions once a source is selected and shows a partial "Select all"', async () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  const allow = within(dialog).getByRole('button', { name: /^Allow/ });
  expect(allow).toBeDisabled();

  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' }));
  expect(allow).toBeEnabled();
  expect(within(dialog).getByRole('checkbox', { name: 'Select all' })).toHaveProperty('indeterminate', true);

  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Select all' }));
  expect(within(dialog).getByRole('checkbox', { name: 'pbs.twimg.com' })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'Select all' })).toHaveProperty('indeterminate', false);
});

it('"Allow" unblocks the selected sources in the panels listed only and recounts the banner', async () => {
  const emit = jest.spyOn(appEvents, 'emit');
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' }));
  await userEvent.click(within(dialog).getByRole('button', { name: /^Allow/ }));

  expect(getAllowedOrigins(dashboardUid, 2)).toEqual([dicebear]);
  expect(getAllowedOrigins(dashboardUid, 1)).toEqual([]);
  expect(getAllowedOrigins('another-dashboard', 2)).toEqual([]);
  expect(emit).toHaveBeenCalledWith(AppEvents.alertSuccess, ['1 source is now allowed in the panels listed']);
  expect(screen.getByText('5 resources from 1 source are blocked')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('only allows the panels that were listed when the review opened', async () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' }));
  act(() => {
    reportBlocked('late', {
      dashboardUid,
      panelId: 3,
      panelTitle: 'Reported while open',
      origins: [{ origin: dicebear, urls: [{ url: `${dicebear}/svg?seed=leak`, count: 1 }] }],
    });
  });
  expect(within(dialog).queryByText('Reported while open')).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: /^Allow/ }));

  expect(getAllowedOrigins(dashboardUid, 2)).toEqual([dicebear]);
  expect(getAllowedOrigins(dashboardUid, 3)).toEqual([]);
});

it('keeps the review and its selection while a panel reloads and reports again', async () => {
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' }));
  act(() => {
    clearBlocked('text-sample');
    clearBlocked('mixed');
  });
  expect(screen.getByRole('dialog')).toBe(dialog);
  reportMockupPanels();
  expect(within(dialog).getByRole('checkbox', { name: 'api.dicebear.com' })).toBeChecked();
});

it('"Always allow" unblocks the selected sources on every dashboard and hides the banner when none are left', async () => {
  const emit = jest.spyOn(appEvents, 'emit');
  render(<SandboxConsentBanner dashboardUid={dashboardUid} />);
  reportMockupPanels();
  const dialog = await openReview();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Select all' }));
  await userEvent.click(within(dialog).getByRole('button', { name: /^Always allow/ }));

  expect(getAllowedOrigins('another-dashboard')).toEqual([dicebear, twimg]);
  expect(emit).toHaveBeenCalledWith(AppEvents.alertSuccess, ['2 sources are now allowed for 30 days']);
  expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
});
