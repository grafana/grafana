import { render } from '@testing-library/react';

import { type UPlotConfigBuilder } from '@grafana/ui';

import { AnnotationsPlugin } from './AnnotationsPlugin';

jest.mock('./AnnotationsPlugin');
const mockAnnotationsPlugin2Cluster = jest.mocked(AnnotationsPlugin);

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
    mockAnnotationsPlugin2Cluster.mockClear();
    mockAnnotationsPlugin2Cluster.mockImplementation(() => null);
  });

  it('renders AnnotationsPlugin2Cluster', () => {
    render(<AnnotationsPlugin {...defaultProps} />);
    expect(mockAnnotationsPlugin2Cluster).toHaveBeenCalledWith(
      expect.objectContaining({ config: defaultProps.config, annotations: [] }),
      expect.objectContaining({})
    );
  });
});
