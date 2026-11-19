import { useEffect } from 'react';
import { act, render, screen, within } from 'test/test-utils';

import { type Props as SortPickerProps } from 'app/core/components/Select/SortPicker';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import {
  type TemplateSelection,
  type TemplateSelectionProps,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

import { LOAD_WAIT_MS, LandingTemplates } from './LandingTemplates';

// `undefined` keeps a list loading.
let mockGrafanaCount: number | undefined = 1;
let mockCustomCount: number | undefined = 1;
// What the Grafana list was last rendered with.
let mockGrafanaProps: TemplateSelectionProps & { entryPoint?: string } = {};
// Called with the entry point on every render of the custom list.
const mockCustomEntryPoint = jest.fn();
// What clicking a Grafana card picks.
const mockSelection: TemplateSelection = {
  id: 'grafana:1',
  title: 'RED metrics',
  kind: 'template_dashboard',
  url: '/dashboard/template?gnetId=1',
  contextItem: { node: { id: 'template-red', name: 'RED metrics', navigable: false }, occurrences: [] },
};

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab', () => {
  const { useEffect: useMockEffect } = jest.requireActual('react');
  return {
    GrafanaTemplatesTab: (props: TemplateSelectionProps & { entryPoint?: string }) => {
      const { onTemplatesLoad, onSelectTemplate } = props;
      mockGrafanaProps = props;
      useMockEffect(() => {
        if (mockGrafanaCount !== undefined) {
          onTemplatesLoad?.(mockGrafanaCount);
        }
      }, [onTemplatesLoad]);
      return (mockGrafanaCount ?? 0) > 0 ? (
        <article data-testid="grafana-card" onClick={() => onSelectTemplate?.(mockSelection)} />
      ) : null;
    },
  };
});

// The real picker loads its options asynchronously; a plain select keeps these tests synchronous.
jest.mock('app/core/components/Select/SortPicker', () => ({
  SortPicker: ({ value, onChange, placeholder }: SortPickerProps) => (
    <select aria-label={placeholder} value={value ?? ''} onChange={(e) => onChange({ value: e.target.value })}>
      <option value="" />
      <option value="asc">A–Z</option>
      <option value="desc">Z–A</option>
    </select>
  ),
}));

jest.mock(
  'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension',
  () => ({
    getDashboardTemplatesTab: jest.fn(),
  })
);

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);
const CustomTemplates = ({ onTemplatesLoad, entryPoint }: TemplateSelectionProps & { entryPoint?: string }) => {
  mockCustomEntryPoint(entryPoint);
  useEffect(() => {
    if (mockCustomCount !== undefined) {
      onTemplatesLoad?.(mockCustomCount);
    }
  }, [onTemplatesLoad]);
  return (mockCustomCount ?? 0) > 0 ? <article data-testid="custom-card" /> : null;
};

function renderTemplates(props: Partial<Parameters<typeof LandingTemplates>[0]> = {}) {
  return render(
    <LandingTemplates
      testDataSource={undefined}
      showGrafanaTemplates
      showCustomTemplates
      onSelectTemplate={jest.fn()}
      {...props}
    />
  );
}

describe('LandingTemplates', () => {
  beforeEach(() => {
    mockGrafanaCount = 1;
    mockCustomCount = 1;
    mockGetDashboardTemplatesTab.mockReturnValue(CustomTemplates);
  });

  it('lays out custom templates, then the Grafana ones, in one grid', () => {
    renderTemplates();

    const custom = screen.getByTestId('custom-card');
    const grafana = screen.getByTestId('grafana-card');
    expect(custom.parentElement).toBe(grafana.parentElement);
    expect(custom.compareDocumentPosition(grafana) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tags both lists with the landing as their entry point', () => {
    renderTemplates();

    expect(mockGrafanaProps.entryPoint).toBe('emptyDashboardPrompt');
    expect(mockCustomEntryPoint).toHaveBeenLastCalledWith('emptyDashboardPrompt');
  });

  it('lists every template unfiltered, with no search of its own', () => {
    renderTemplates();

    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
    expect(mockGrafanaProps.searchQuery).toBeUndefined();
  });

  it('searches and sorts every template in the Browse all dialog', async () => {
    const { user } = renderTemplates();

    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByPlaceholderText('Search')).toHaveFocus();
    await user.keyboard('node');
    expect(mockGrafanaProps.searchQuery).toBe('node');

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Sort' }), 'desc');
    expect(mockGrafanaProps.sortOrder).toBe('desc');
  });

  it('adds a no-matches line while a search is on, which CSS hides while the grid has cards', async () => {
    const { user } = renderTemplates();
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    expect(screen.queryByText('No template dashboards found')).not.toBeInTheDocument();

    await user.keyboard('nothing like it');
    expect(screen.getByText('No template dashboards found')).toBeInTheDocument();
  });

  it('attaches a template picked in the dialog and closes it', async () => {
    const onSelectTemplate = jest.fn();
    const { user } = renderTemplates({ onSelectTemplate });
    await user.click(screen.getByRole('button', { name: 'Browse all' }));

    await user.click(within(screen.getByRole('dialog')).getByTestId('grafana-card'));

    expect(onSelectTemplate).toHaveBeenCalledWith(mockSelection);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no Browse all without templates to browse', () => {
    mockGrafanaCount = 0;
    mockCustomCount = 0;
    renderTemplates();

    expect(screen.queryByRole('button', { name: 'Browse all' })).not.toBeInTheDocument();
  });

  it('holds its place while hidden, out of sight and out of the accessibility tree', () => {
    const { container } = renderTemplates({ hidden: true });

    expect(container.querySelector('section')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('collapses and expands the templates from their header', async () => {
    const { user } = renderTemplates();
    const toggle = screen.getByRole('button', { name: 'Start from a template' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('grafana-card')).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByTestId('grafana-card')).toBeVisible();
  });

  it('tells its host before a person opens or closes it', async () => {
    const onToggle = jest.fn();
    const { user } = renderTemplates({ onToggle });

    await user.click(screen.getByRole('button', { name: 'Start from a template' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the lists mounted while closed, so reopening does not reload them', async () => {
    const { user } = renderTemplates();
    const card = screen.getByTestId('grafana-card');
    const toggle = screen.getByRole('button', { name: 'Start from a template' });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.getByTestId('grafana-card')).toBe(card);
  });

  it('holds every card back until all lists have loaded, so they do not reflow', () => {
    mockCustomCount = undefined;
    renderTemplates();

    expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('grafana-card')).not.toBeVisible();
  });

  describe('when a list never reports', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('shows the cards that loaded after a short wait', () => {
      mockCustomCount = undefined;
      renderTemplates();
      expect(screen.getByTestId('grafana-card')).not.toBeVisible();

      act(() => jest.advanceTimersByTime(LOAD_WAIT_MS));

      expect(screen.getByTestId('grafana-card')).toBeVisible();
    });

    it('keeps waiting while no list has shown a card, and does not call the panel empty', () => {
      mockCustomCount = undefined;
      mockGrafanaCount = undefined;
      renderTemplates();

      act(() => jest.advanceTimersByTime(LOAD_WAIT_MS));

      expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
    });
  });

  it('starts closed when no list has templates, and says so when opened', async () => {
    mockGrafanaCount = 0;
    mockCustomCount = 0;
    const { user } = renderTemplates();
    const toggle = screen.getByRole('button', { name: 'Start from a template' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('No templates available')).toBeInTheDocument();
  });

  it('stays open when only one list has templates', () => {
    mockCustomCount = 0;
    renderTemplates();

    expect(screen.getByRole('button', { name: 'Start from a template' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
  });

  it('leaves out custom templates when they are not available', () => {
    renderTemplates({ showCustomTemplates: false });

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafana-card')).toBeInTheDocument();
  });

  it('leaves out custom templates when no enterprise list is registered', () => {
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    renderTemplates();

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
  });
});
