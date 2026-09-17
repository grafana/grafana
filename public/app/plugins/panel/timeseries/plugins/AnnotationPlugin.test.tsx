import { render } from '@testing-library/react';

import { type UPlotConfigBuilder } from '@grafana/ui';

import { AnnotationsPlugin } from './AnnotationsPlugin';

jest.mock('./AnnotationsPlugin');
const mockAnnotationsPlugin = jest.mocked(AnnotationsPlugin);

/**
 * This test checks that we're rendering the expected component for the given value of the feature flag
 */
describe('AnnotationsPlugin', () => {
  const defaultProps = {
    config: {} as UPlotConfigBuilder,
    annotations: [],
    timeZone: 'browser',
    newRange: null,
    setNewRange: jest.fn(),
    replaceVariables: (v: string) => v,
    options: {},
  };
  beforeEach(() => {
    mockAnnotationsPlugin.mockClear();
    mockAnnotationsPlugin.mockImplementation(() => null);
  });

  it('renders AnnotationsPlugin', () => {
    render(<AnnotationsPlugin {...defaultProps} />);
    expect(mockAnnotationsPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ config: defaultProps.config, annotations: [] }),
      expect.objectContaining({})
    );
  });
});
