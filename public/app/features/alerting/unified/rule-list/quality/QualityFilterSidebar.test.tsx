import { render } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { setupMswServer } from '../../mockApi';
import { Annotation } from '../../utils/constants';

import { QualityFilterSidebar } from './QualityFilterSidebar';
import { type FindingTypeCounts, type SeverityCounts } from './qualityFindingFilters';
import { useQualityExtraFilters } from './useQualityExtraFilters';

setupMswServer();

const severityCounts: SeverityCounts = { high: 2, medium: 3, low: 0 };
const findingCounts: FindingTypeCounts = {
  [Annotation.summary]: 3,
  [Annotation.description]: 2,
  [Annotation.runbookURL]: 1,
};

const ui = {
  severityReadout: byTestId('severity'),
  findingTypesReadout: byTestId('finding-types'),
  highSeverityRadio: byRole('radio', { name: /High/ }),
  mediumSeverityRadio: byRole('radio', { name: /Medium/ }),
  summaryFindingButton: byRole('button', { name: /Summary/ }),
  descriptionFindingButton: byRole('button', { name: /Description/ }),
  runbookFindingButton: byRole('button', { name: /Runbook URL/ }),
  clearButton: byRole('button', { name: /clear filters/i }),
};

/** Renders the sidebar with readouts of the URL-backed severity / finding-type filters. */
function SidebarHarness() {
  const { severity, findingTypes } = useQualityExtraFilters();

  return (
    <>
      <QualityFilterSidebar severityCounts={severityCounts} findingCounts={findingCounts} />
      <div data-testid="severity">{severity}</div>
      <div data-testid="finding-types">{findingTypes.join(',')}</div>
    </>
  );
}

function renderSidebar(initialQueryString = '') {
  const url = `/alerting/list/quality${initialQueryString ? `?${initialQueryString}` : ''}`;
  return render(<SidebarHarness />, { historyOptions: { initialEntries: [url] } });
}

describe('QualityFilterSidebar', () => {
  it('renders severity options with their counts', async () => {
    renderSidebar();

    expect(await ui.highSeverityRadio.find()).toHaveTextContent('2');
    expect(ui.mediumSeverityRadio.get()).toHaveTextContent('3');
  });

  it('renders a finding-type option per type with its count', async () => {
    renderSidebar();

    expect(await ui.summaryFindingButton.find()).toHaveTextContent('3');
    expect(ui.descriptionFindingButton.get()).toHaveTextContent('2');
    expect(ui.runbookFindingButton.get()).toHaveTextContent('1');
  });

  it('updates the severity filter (and URL) when a severity is selected', async () => {
    const { user } = renderSidebar();

    expect(await ui.severityReadout.find()).toHaveTextContent('all');

    await user.click(ui.highSeverityRadio.get());

    expect(ui.severityReadout.get()).toHaveTextContent('high');
  });

  it('supports selecting multiple finding types', async () => {
    const { user } = renderSidebar();

    expect(await ui.findingTypesReadout.find()).toHaveTextContent('');

    await user.click(ui.summaryFindingButton.get());
    await user.click(ui.descriptionFindingButton.get());

    // Order is normalized to the canonical finding-type order regardless of click order.
    expect(ui.findingTypesReadout.get()).toHaveTextContent(`${Annotation.summary},${Annotation.description}`);

    // Toggling an active type off removes just that one.
    await user.click(ui.summaryFindingButton.get());
    expect(ui.findingTypesReadout.get()).toHaveTextContent(Annotation.description);
  });

  it('clears severity and finding-type filters', async () => {
    const { user } = renderSidebar('qualitySeverity=medium&qualityFinding=summary');

    expect(await ui.severityReadout.find()).toHaveTextContent('medium');
    expect(ui.findingTypesReadout.get()).toHaveTextContent(Annotation.summary);

    await user.click(ui.clearButton.get());

    expect(ui.severityReadout.get()).toHaveTextContent('all');
    expect(ui.findingTypesReadout.get()).toHaveTextContent('');
  });

  it('disables Clear filters when nothing is active', async () => {
    renderSidebar();

    expect(await ui.clearButton.find()).toBeDisabled();
  });
});
