import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PanelStatusStore } from '@grafana/data/internal';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';
import {
  allowOrigins,
  clearBlocked,
  reportBlocked,
} from 'app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent';

import { TextSandboxConsentNotice } from './TextSandboxConsentNotice';

const IMG = 'https://images.example.com';
const FONTS = 'https://fonts.example.com';

let uidCounter = 0;
let dashboardUid = '';
let notices: PanelStatusStore;

function setup(panelId = 7, panelTitle = 'Text panel') {
  notices = new PanelStatusStore();
  return render(
    <PanelContextProvider value={{ notices } as unknown as PanelContext}>
      <TextSandboxConsentNotice consent={{ panelId, panelTitle, dashboardUid }} />
    </PanelContextProvider>
  );
}

function report(key: string, origin: string, panelId = 7, panelTitle = 'Text panel') {
  act(() => {
    reportBlocked(key, {
      dashboardUid,
      panelId,
      panelTitle,
      origins: [{ origin, urls: [{ url: `${origin}/a.png`, count: 1 }] }],
    });
  });
}

beforeEach(() => {
  dashboardUid = `consent-notice-${uidCounter++}`;
});

afterEach(() => {
  clearBlocked('notice-a');
  clearBlocked('notice-b');
  clearBlocked('notice-other');
  window.localStorage.clear();
  window.sessionStorage.clear();
});

it('publishes no notice when nothing is blocked', () => {
  setup();
  expect(notices.getSnapshot().items).toEqual([]);
});

it('publishes a warning naming the blocked host for this panel', () => {
  setup();
  report('notice-a', IMG);

  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    origin: 'panel',
    severity: 'warning',
    text: 'External content from images.example.com is blocked pending viewer approval',
    assistant: 'hidden',
  });
  expect(items[0].actions).toHaveLength(1);
  expect(items[0].actions![0].label).toBe('Review blocked content');
});

it('counts sources instead of hosts when several are blocked', () => {
  setup();
  report('notice-a', IMG);
  report('notice-b', FONTS);

  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0].text).toBe('External content from 2 sources are blocked pending viewer approval');
});

it('keeps repeated copies independent: each warns only for its own panel id', () => {
  const first = new PanelStatusStore();
  const second = new PanelStatusStore();
  render(
    <PanelContextProvider value={{ notices: first } as unknown as PanelContext}>
      <TextSandboxConsentNotice consent={{ panelId: 7, panelTitle: 'Text panel', dashboardUid }} />
    </PanelContextProvider>
  );
  render(
    <PanelContextProvider value={{ notices: second } as unknown as PanelContext}>
      <TextSandboxConsentNotice consent={{ panelId: 8, panelTitle: 'Text panel', dashboardUid }} />
    </PanelContextProvider>
  );
  report('notice-a', IMG, 7);

  expect(first.getSnapshot().items).toHaveLength(1);
  expect(second.getSnapshot().items).toEqual([]);
});

it('ignores blocked sources from other panels and dashboards', () => {
  setup();
  act(() => {
    reportBlocked('notice-other', {
      dashboardUid,
      panelId: 8,
      panelTitle: 'Other panel',
      origins: [{ origin: IMG, urls: [] }],
    });
  });
  expect(notices.getSnapshot().items).toEqual([]);
});

it('keeps a stable identity across rerenders without duplicating', () => {
  const rendered = setup();
  report('notice-a', IMG);
  rendered.rerender(
    <PanelContextProvider value={{ notices } as unknown as PanelContext}>
      <TextSandboxConsentNotice consent={{ panelId: 7, panelTitle: 'Text panel', dashboardUid }} />
    </PanelContextProvider>
  );
  report('notice-b', FONTS);

  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0].text).toBe('External content from 2 sources are blocked pending viewer approval');
});

it('clears the notice when the panel unmounts', () => {
  const rendered = setup();
  report('notice-a', IMG);
  expect(notices.getSnapshot().items).toHaveLength(1);

  rendered.unmount();
  expect(notices.getSnapshot().items).toEqual([]);
});

it('renders nothing and publishes nothing without panel notice support', () => {
  const rendered = render(
    <PanelContextProvider value={{} as PanelContext}>
      <TextSandboxConsentNotice consent={{ panelId: 7, panelTitle: 'Text panel', dashboardUid }} />
    </PanelContextProvider>
  );
  report('notice-a', IMG);
  expect(rendered.container).toBeEmptyDOMElement();
});

it('opens the consent review from the notice action without granting consent', async () => {
  setup();
  report('notice-a', IMG);

  const action = notices.getSnapshot().items[0].actions![0];
  await act(async () => {
    await action.onClick();
  });

  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('images.example.com');
  // Opening the review grants nothing: the warning is still there afterwards.
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(notices.getSnapshot().items).toHaveLength(1);
});

it('clears the notice once every source is allowed through the review', async () => {
  setup(7);
  report('notice-a', IMG);

  const action = notices.getSnapshot().items[0].actions![0];
  await act(async () => {
    await action.onClick();
  });
  await userEvent.click(screen.getByRole('checkbox', { name: 'images.example.com' }));
  await userEvent.click(screen.getByRole('button', { name: /Allow$/ }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(notices.getSnapshot().items).toEqual([]);
});

it('keeps warning for remaining sources after a partial approval', () => {
  setup();
  report('notice-a', IMG);
  report('notice-b', FONTS);
  expect(notices.getSnapshot().items[0].text).toBe(
    'External content from 2 sources are blocked pending viewer approval'
  );

  act(() => {
    allowOrigins([{ origin: IMG, panelIds: [7] }], 'dashboard', dashboardUid);
  });

  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0].text).toBe('External content from fonts.example.com is blocked pending viewer approval');
});

it('warns again when new content becomes blocked after consent', () => {
  setup();
  report('notice-a', IMG);
  act(() => {
    allowOrigins([{ origin: IMG, panelIds: [7] }], 'dashboard', dashboardUid);
  });
  expect(notices.getSnapshot().items).toEqual([]);

  // New blocked content (or consent expiring) re-creates the warning.
  report('notice-b', FONTS);
  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0].text).toBe('External content from fonts.example.com is blocked pending viewer approval');
});
