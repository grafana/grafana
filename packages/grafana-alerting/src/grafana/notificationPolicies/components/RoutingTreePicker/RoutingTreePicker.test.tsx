import { useState } from 'react';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import { type RoutingTreeView } from '../../routingTreeView';
import {
  simpleRoutingTreesList,
  simpleRoutingTreesListScenario,
} from '../RoutingTreeSelector/RoutingTreeSelector.scenario';

import { RoutingTreePicker } from './RoutingTreePicker';

const server = setupMockServer();

const customTree: RoutingTreeView = {
  name: simpleRoutingTreesList.items[1].metadata.name!,
  isDefault: false,
  defaults: {},
};

beforeEach(() => {
  server.use(...simpleRoutingTreesListScenario);
});

beforeAll(() => {
  mockComboboxRect();
});

describe('default (collapsed) state', () => {
  it('shows the default policy badge and no selector when nothing is explicitly selected', () => {
    render(<RoutingTreePicker value={null} onChange={jest.fn()} />);

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('expands to a labelled selector when Change is clicked', async () => {
    const { user } = render(<RoutingTreePicker value={null} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Change notification policy' }));

    expect(screen.getByRole('combobox', { name: 'Select notification policy' })).toHaveValue('Default policy');
  });

  it('collapses back to the badge when Collapse is clicked, without calling onChange', async () => {
    const onChangeHandler = jest.fn();
    const { user } = render(<RoutingTreePicker value={null} onChange={onChangeHandler} />);

    await user.click(screen.getByRole('button', { name: 'Change notification policy' }));
    await user.click(screen.getByRole('button', { name: 'Collapse the notification policy selector' }));

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(onChangeHandler).not.toHaveBeenCalled();
  });

  it('hides the View policies link when no href is provided', () => {
    render(<RoutingTreePicker value={null} onChange={jest.fn()} />);

    expect(screen.queryByText('View policies')).not.toBeInTheDocument();
  });

  it('shows the View policies link when a href is provided', () => {
    render(<RoutingTreePicker value={null} onChange={jest.fn()} viewPoliciesHref="/alerting/routes" />);

    expect(screen.getByRole('link', { name: /view notification policies/i })).toHaveAttribute(
      'href',
      '/alerting/routes'
    );
  });

  describe('View policies links on a subpath', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });

    afterEach(() => {
      locationUtil.initialize({
        config: { appSubUrl: config.appSubUrl } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });

    it.each([
      ['/alerting/routes', '/grafana/alerting/routes'],
      ['/grafana/alerting/routes', '/grafana/alerting/routes'],
      ['https://example.com/alerting/routes', 'https://example.com/alerting/routes'],
    ])('opens %s at %s in a new tab', (href, expected) => {
      render(<RoutingTreePicker value={null} onChange={jest.fn()} viewPoliciesHref={href} />);

      const link = screen.getByRole('link', { name: /view notification policies/i });
      expect(link).toHaveAttribute('href', expected);
      expect(link).toHaveAttribute('target', '_blank');
    });
  });
});

describe('custom policy selected', () => {
  it('shows the selector expanded, with a reset button, when a non-default tree is already selected', () => {
    render(<RoutingTreePicker value={customTree} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText('Default policy')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to default policy' })).toBeInTheDocument();
  });

  it('calls onChange with the selected routing tree', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreePicker value={null} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('button', { name: 'Change notification policy' }));

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: new RegExp(customTree.name) }));

    expect(onChangeHandler).toHaveBeenCalledWith(expect.objectContaining({ name: customTree.name, isDefault: false }));
  });

  it('resets to the default policy when Reset to default is clicked', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreePicker value={customTree} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('button', { name: 'Reset to default policy' }));

    expect(onChangeHandler).toHaveBeenCalledWith(null);
  });

  it('stays expanded on the custom policy when the parent does not accept the reset', async () => {
    const { user } = render(<RoutingTreePicker value={customTree} onChange={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Reset to default policy' }));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText('Default policy')).not.toBeInTheDocument();
  });

  it('collapses to the default policy once the parent accepts the reset', async () => {
    function Controlled() {
      const [value, setValue] = useState<RoutingTreeView | null>(customTree);
      return <RoutingTreePicker value={value} onChange={setValue} />;
    }

    const { user } = render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'Reset to default policy' }));

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('normalizes selecting "Default policy" from the dropdown to null, same as Reset to default', async () => {
    const onChangeHandler = jest.fn();

    const { user } = render(<RoutingTreePicker value={customTree} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /default policy/i }));

    expect(onChangeHandler).toHaveBeenCalledWith(null);
  });
});

describe('preview', () => {
  it('previews which policy would receive the notification once a tree is selected', async () => {
    render(
      <RoutingTreePicker value={customTree} onChange={jest.fn()} instancesToPreview={[[['severity', 'critical']]]} />
    );

    expect(await screen.findByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(simpleRoutingTreesList.items[1].spec.defaults.receiver!)).toBeInTheDocument();
  });

  it('previews the actual default policy when value is null', async () => {
    const defaultTree = simpleRoutingTreesList.items[0];

    render(<RoutingTreePicker value={null} onChange={jest.fn()} instancesToPreview={[[['severity', 'critical']]]} />);

    expect(await screen.findByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(defaultTree.spec.defaults.receiver!)).toBeInTheDocument();
  });
});
