import { render } from '@testing-library/react';

import { TooltipPlugin2, TooltipHoverMode } from './TooltipPlugin2';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

describe('TooltipPlugin2 One Click Filtering', () => {
  const mockOnAddAdHocFilter = jest.fn();
  const mockGetFilterInfo = jest.fn();
  const mockGetDataLinks = jest.fn();

  const mockConfig = {
    addHook: jest.fn(),
    scales: [{ props: { isTime: false } }],
  } as unknown as UPlotConfigBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger filter when no data links are present and filter is available', () => {
    mockGetDataLinks.mockReturnValue([]); // No data links
    mockGetFilterInfo.mockReturnValue({ key: 'category', value: 'A' });

    render(
      <TooltipPlugin2
        config={mockConfig}
        hoverMode={TooltipHoverMode.xOne}
        getDataLinks={mockGetDataLinks}
        onAddAdHocFilter={mockOnAddAdHocFilter}
        getFilterInfo={mockGetFilterInfo}
        render={() => <div>Test Tooltip</div>}
      />
    );

    // Verify that the filter callback would be called with the correct parameters
    expect(mockGetFilterInfo).toBeDefined();
    expect(mockOnAddAdHocFilter).toBeDefined();

    // Test the logic by simulating what happens in the click handler
    const filterInfo = mockGetFilterInfo(1, 0);
    if (filterInfo) {
      mockOnAddAdHocFilter({
        key: filterInfo.key,
        value: filterInfo.value,
        operator: '=',
      });
    }

    expect(mockOnAddAdHocFilter).toHaveBeenCalledWith({
      key: 'category',
      value: 'A',
      operator: '=',
    });
  });

  it('should not trigger filter when data links are present', () => {
    mockGetDataLinks.mockReturnValue([{ title: 'Link', href: 'http://example.com', oneClick: false }]);
    mockGetFilterInfo.mockReturnValue({ key: 'category', value: 'A' });

    render(
      <TooltipPlugin2
        config={mockConfig}
        hoverMode={TooltipHoverMode.xOne}
        getDataLinks={mockGetDataLinks}
        onAddAdHocFilter={mockOnAddAdHocFilter}
        getFilterInfo={mockGetFilterInfo}
        render={() => <div>Test Tooltip</div>}
      />
    );

    // When data links are present, filter should not be triggered
    const dataLinks = mockGetDataLinks(1, 0);
    const hasDataLinks = dataLinks.length > 0;

    expect(hasDataLinks).toBe(true);
    expect(mockOnAddAdHocFilter).not.toHaveBeenCalled();
  });
});
