import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type FieldDef } from '../logParser';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetailsFields, resolveAppFromLink } from './LogLineDetailsFields';
import { LogListContext } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('./LogListContext');

function createFields(count: number): FieldDef[] {
  return Array.from({ length: count }, (_, i) => ({
    keys: [`field_${i}`],
    values: [`value_${i}`],
    fieldIndex: i,
  }));
}

function renderFields(fields: FieldDef[]) {
  const log = createLogLine();
  return render(
    <LogListContext.Provider value={defaultValue}>
      <LogLineDetailsFields fields={fields} log={log} logs={[log]} />
    </LogListContext.Provider>
  );
}

describe('LogLineDetailsFields', () => {
  it('caps the number of rendered rows and paginates through the rest', async () => {
    renderFields(createFields(450));

    // Only the first page (50 rows) is mounted, never all 450 rows at once.
    expect(screen.getByText('field_0')).toBeInTheDocument();
    expect(screen.getByText('field_49')).toBeInTheDocument();
    expect(screen.queryByText('field_50')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByLabelText('next page')[0]);

    expect(screen.queryByText('field_0')).not.toBeInTheDocument();
    expect(screen.getByText('field_50')).toBeInTheDocument();
    expect(screen.getByText('field_99')).toBeInTheDocument();
  });

  it('does not render pagination controls when everything fits on one page', () => {
    renderFields(createFields(5));

    expect(screen.getByText('field_0')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('hides the top pagination controls, but not the bottom ones, once on a short last page', async () => {
    renderFields(createFields(120)); // 50 per page -> pages of 50, 50, 20 (short last page)

    // Not on the last page yet: both the top and bottom pagination controls render.
    expect(screen.getAllByRole('navigation')).toHaveLength(2);

    await userEvent.click(screen.getAllByLabelText('next page')[0]); // page 2 of 3
    await userEvent.click(screen.getAllByLabelText('next page')[0]); // page 3 of 3 (last, short)

    expect(screen.getByText('field_100')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('keeps both pagination controls when the last page is a full page', async () => {
    renderFields(createFields(100)); // 50 per page -> pages of 50, 50 (last page is also full)

    await userEvent.click(screen.getAllByLabelText('next page')[0]); // page 2 of 2 (last, full)

    expect(screen.getByText('field_99')).toBeInTheDocument();
    // The last page is just as long as any other, so there's still something to skip past -
    // the top control stays so the user doesn't have to scroll past all of it to navigate.
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
  });
});

describe('resolveAppFromLink', () => {
  it.each([
    ['https://slug.grafana.net/a/grafana-app-observability-app/', 'grafana-app-observability-app'],
    ['https://slug.grafana.net/a/grafana-kowalski-app/', 'grafana-kowalski-app'],
    ['https://slug.grafana.net/a/grafana-k8s-app/', 'grafana-k8s-app'],
    ['https://slug.grafana.net/a/grafana-dbo11y-app/', 'grafana-dbo11y-app'],
  ])('resolves the app name from %s', (href, expected) => {
    expect(resolveAppFromLink(href)).toBe(expected);
  });

  it('resolves the app name with a deeper path and query params', () => {
    expect(resolveAppFromLink('https://foo/a/grafana-k8s-app/some/deep/path?x=1#hash')).toBe('grafana-k8s-app');
  });

  it('returns undefined when there is no /a/ segment', () => {
    expect(resolveAppFromLink('https://slug.grafana.net/d/dashboard-uid/')).toBeUndefined();
  });
});
