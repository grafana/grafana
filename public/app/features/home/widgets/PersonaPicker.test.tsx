import { render, screen } from 'test/test-utils';

import { PersonaPicker } from './PersonaPicker';
import { type HomeWidgetCatalogEntry } from './types';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string, values?: Record<string, string>) =>
    values ? defaultValue.replace('{{widgets}}', values.widgets) : defaultValue,
}));

function makeEntry(id: string, title: string): HomeWidgetCatalogEntry {
  return {
    id,
    title,
    description: '',
    icon: 'apps',
    source: 'core',
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 6, h: 4 },
    render: () => null,
  };
}

describe('PersonaPicker', () => {
  it('lists only widgets that are currently available in the catalog', () => {
    render(
      <PersonaPicker
        catalog={[makeEntry('alerts', 'Firing alerts'), makeEntry('dashboards', 'Dashboards')]}
        onApply={jest.fn()}
        onStartBlank={jest.fn()}
      />
    );

    expect(screen.getAllByText('Includes Firing alerts, Dashboards')).toHaveLength(3);
    expect(screen.getAllByText('Includes Dashboards')).toHaveLength(1);
    expect(screen.queryByText(/Includes .*Active incidents/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Includes .*On-call shifts/)).not.toBeInTheDocument();
  });

  it('applies the complete persona widget id list so unavailable ids can be filtered by layout packing', async () => {
    const onApply = jest.fn();
    const { user } = render(
      <PersonaPicker catalog={[makeEntry('dashboards', 'Dashboards')]} onApply={onApply} onStartBlank={jest.fn()} />
    );

    await user.click(screen.getByText('Incident response'));

    expect(onApply).toHaveBeenCalledWith(['alerts', 'incidents', 'oncall', 'slos', 'dashboards']);
  });
});
