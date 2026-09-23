import { mockComboboxRect } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';

import { render, screen } from '../../../../../tests/test-utils';
import {
  simpleRoutingTreesList,
  simpleRoutingTreesListScenario,
} from '../RoutingTreeSelector/RoutingTreeSelector.scenario';

import { RoutingTreePicker } from './RoutingTreePicker';

const server = setupMockServer();

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
});

describe('custom policy selected', () => {
  it('shows the selector expanded, with a reset button, when a non-default tree is already selected', () => {
    const customTree = simpleRoutingTreesList.items[1];

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
    const customTree = simpleRoutingTreesList.items[1];
    await user.click(await screen.findByRole('option', { name: new RegExp(customTree.metadata.name!) }));

    expect(onChangeHandler).toHaveBeenCalledWith(customTree);
  });

  it('resets to the default policy when Reset to default is clicked', async () => {
    const onChangeHandler = jest.fn();
    const customTree = simpleRoutingTreesList.items[1];

    const { user } = render(<RoutingTreePicker value={customTree} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('button', { name: 'Reset to default policy' }));

    expect(onChangeHandler).toHaveBeenCalledWith(null);
  });

  it('normalizes selecting "Default policy" from the dropdown to null, same as Reset to default', async () => {
    const onChangeHandler = jest.fn();
    const customTree = simpleRoutingTreesList.items[1];

    const { user } = render(<RoutingTreePicker value={customTree} onChange={onChangeHandler} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /default policy/i }));

    expect(onChangeHandler).toHaveBeenCalledWith(null);
  });
});

describe('preview', () => {
  it('previews which policy would receive the notification once a tree is selected', () => {
    const selectedTree = simpleRoutingTreesList.items[1];

    render(
      <RoutingTreePicker value={selectedTree} onChange={jest.fn()} instancesToPreview={[[['severity', 'critical']]]} />
    );

    expect(screen.getByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(selectedTree.spec.defaults.receiver!)).toBeInTheDocument();
  });

  it('previews the actual default policy when value is null', async () => {
    const defaultTree = simpleRoutingTreesList.items[0];

    render(<RoutingTreePicker value={null} onChange={jest.fn()} instancesToPreview={[[['severity', 'critical']]]} />);

    expect(await screen.findByText('Who would get notified')).toBeInTheDocument();
    expect(screen.getByText(defaultTree.spec.defaults.receiver!)).toBeInTheDocument();
  });
});
