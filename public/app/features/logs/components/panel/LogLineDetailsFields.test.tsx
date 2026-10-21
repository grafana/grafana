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

    // Only the first page (200 rows) is mounted, never all 450 rows at once.
    expect(screen.getByText('field_0')).toBeInTheDocument();
    expect(screen.getByText('field_199')).toBeInTheDocument();
    expect(screen.queryByText('field_200')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('next page'));

    expect(screen.queryByText('field_0')).not.toBeInTheDocument();
    expect(screen.getByText('field_200')).toBeInTheDocument();
    expect(screen.getByText('field_399')).toBeInTheDocument();
  });

  it('does not render pagination controls when everything fits on one page', () => {
    renderFields(createFields(5));

    expect(screen.getByText('field_0')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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
