import { type MutableRefObject, useEffect } from 'react';
import { act, render, screen } from 'test/test-utils';

import { type Props as SortPickerProps } from 'app/core/components/Select/SortPicker';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelectionProps } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

import { LOAD_WAIT_MS, LandingTemplates, LandingTemplatesToggle } from './LandingTemplates';

// `undefined` keeps a list loading.
let mockGrafanaCount: number | undefined = 1;
let mockCustomCount: number | undefined = 1;
type ListProps = TemplateSelectionProps & { entryPoint?: string; loadedFiredRef?: MutableRefObject<boolean> };
// What the Grafana list was last rendered with.
let mockGrafanaProps: ListProps = {};
// Called with the entry point and `loaded` guard on every render of the custom list.
const mockCustomProps = jest.fn();

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab', () => {
  const { useEffect: useMockEffect } = jest.requireActual('react');
  return {
    GrafanaTemplatesTab: (props: ListProps) => {
      const { onTemplatesLoad } = props;
      mockGrafanaProps = props;
      useMockEffect(() => {
        if (mockGrafanaCount !== undefined) {
          onTemplatesLoad?.(mockGrafanaCount);
        }
      }, [onTemplatesLoad]);
      return (mockGrafanaCount ?? 0) > 0 ? <article data-testid="grafana-card" /> : null;
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
const CustomTemplates = ({ onTemplatesLoad, entryPoint, loadedFiredRef }: ListProps) => {
  mockCustomProps({ entryPoint, loadedFiredRef });
  useEffect(() => {
    if (mockCustomCount !== undefined) {
      onTemplatesLoad?.(mockCustomCount);
    }
  }, [onTemplatesLoad]);
  return (mockCustomCount ?? 0) > 0 ? <article data-testid="custom-card" /> : null;
};

const onSelectTemplate = jest.fn();

function templates(props: Partial<Parameters<typeof LandingTemplates>[0]> = {}) {
  return (
    <LandingTemplates
      isOpen
      testDataSource={undefined}
      showGrafanaTemplates
      showCustomTemplates
      onSelectTemplate={onSelectTemplate}
      {...props}
    />
  );
}

function renderTemplates(props: Partial<Parameters<typeof LandingTemplates>[0]> = {}) {
  return render(templates(props));
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
    expect(mockCustomProps).toHaveBeenLastCalledWith(expect.objectContaining({ entryPoint: 'emptyDashboardPrompt' }));
  });

  it('gives each list its own unfired `loaded` guard, so both report their load', () => {
    renderTemplates();

    const customRef = mockCustomProps.mock.lastCall?.[0].loadedFiredRef;
    expect(mockGrafanaProps.loadedFiredRef).toEqual({ current: false });
    expect(customRef).toEqual({ current: false });
    expect(customRef).not.toBe(mockGrafanaProps.loadedFiredRef);
  });

  it('searches and sorts the templates from the top of the panel', async () => {
    const { user } = renderTemplates();

    await user.type(screen.getByPlaceholderText('Search'), 'node');
    expect(mockGrafanaProps.searchQuery).toBe('node');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'desc');
    expect(mockGrafanaProps.sortOrder).toBe('desc');
  });

  it('adds a no-matches line while a search is on', async () => {
    const { user } = renderTemplates();
    expect(screen.queryByText('No template dashboards found')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search'), 'nothing like it');
    expect(screen.getByText('No template dashboards found')).toBeInTheDocument();
  });

  it('keeps the list one row and a peek tall while a search matches nothing, so the page does not move', async () => {
    const { user } = renderTemplates();

    await user.type(screen.getByPlaceholderText('Search'), 'nothing like it');

    // The no-matches line sits under the grid, in the list.
    const list = screen.getByText('No template dashboards found').parentElement?.parentElement;
    expect(list).toHaveStyle({ height: 'calc(160px + 16px + 16px + 4px)' });
  });

  it('takes no room while closed, and keeps its lists mounted so reopening does not reload them', () => {
    const { rerender } = renderTemplates();
    const card = screen.getByTestId('grafana-card');

    rerender(templates({ isOpen: false }));
    expect(screen.getByTestId('grafana-card')).not.toBeVisible();

    rerender(templates({ isOpen: true }));
    expect(screen.getByTestId('grafana-card')).toBeVisible();
    expect(screen.getByTestId('grafana-card')).toBe(card);
  });

  it('holds its place while hidden, out of sight and out of the accessibility tree', () => {
    const { container } = renderTemplates({ hidden: true });

    expect(container.querySelector('section')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { hidden: true })).not.toBeVisible();
  });

  it('holds every card back until all lists have loaded, so they do not reflow', () => {
    mockCustomCount = undefined;
    renderTemplates();

    expect(screen.getByRole('region', { name: 'Start from a template' })).toBeVisible();
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
      const onEmptyChange = jest.fn();
      renderTemplates({ onEmptyChange });

      act(() => jest.advanceTimersByTime(LOAD_WAIT_MS));

      expect(onEmptyChange).not.toHaveBeenCalledWith(true);
      expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
    });
  });

  it('tells its host when no list has templates, and says so while open', () => {
    mockGrafanaCount = 0;
    mockCustomCount = 0;
    const onEmptyChange = jest.fn();
    renderTemplates({ onEmptyChange });

    expect(onEmptyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('No templates available')).toBeInTheDocument();
    // The line alone, without the room a row of cards takes.
    expect(screen.getByText('No templates available').parentElement).toHaveStyle({ height: 'auto' });
    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  });

  it('is not empty when only one list has templates', () => {
    mockCustomCount = 0;
    const onEmptyChange = jest.fn();
    renderTemplates({ onEmptyChange });

    expect(onEmptyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('No templates available')).not.toBeInTheDocument();
  });

  it('leaves out custom templates when they are not available', () => {
    renderTemplates({ showCustomTemplates: false });

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafana-card')).toBeVisible();
  });

  it('leaves out custom templates when no enterprise list is registered', () => {
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    renderTemplates();

    expect(screen.queryByTestId('custom-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafana-card')).toBeVisible();
  });
});

describe('LandingTemplatesToggle', () => {
  it('opens and closes the panel it names', async () => {
    const onToggle = jest.fn();
    const { user, rerender } = render(<LandingTemplatesToggle isOpen onToggle={onToggle} controls="templates" />);
    const toggle = screen.getByRole('button', { name: 'Start from a template' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'templates');

    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<LandingTemplatesToggle isOpen={false} onToggle={onToggle} controls="templates" />);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
