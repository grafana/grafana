import { render } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { UPlotConfigBuilder } from '@grafana/ui';

import { AnnotationsPlugin } from './AnnotationPlugin';
import { AnnotationsPlugin2 } from './AnnotationsPlugin2';
import { AnnotationsPlugin2Cluster } from './AnnotationsPlugin2Cluster';

jest.mock('./AnnotationsPlugin2');
jest.mock('./AnnotationsPlugin2Cluster');
const mockAnnotationsPlugin2 = jest.mocked(AnnotationsPlugin2);
const mockAnnotationsPlugin2Cluster = jest.mocked(AnnotationsPlugin2Cluster);

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
  let originalFeatureToggle: boolean | undefined = undefined;
  beforeEach(() => {
    originalFeatureToggle = config.featureToggles.annotationsClustering;
    mockAnnotationsPlugin2.mockClear();
    mockAnnotationsPlugin2Cluster.mockClear();
    mockAnnotationsPlugin2.mockImplementation(() => null);
    mockAnnotationsPlugin2Cluster.mockImplementation(() => null);
  });
  afterEach(() => {
    config.featureToggles.annotationsClustering = originalFeatureToggle;
  });
  it('renders AnnotationsPlugin2Cluster when annotationsClustering is enabled', () => {
    config.featureToggles.annotationsClustering = true;
    render(<AnnotationsPlugin {...defaultProps} />);
    expect(mockAnnotationsPlugin2Cluster).toHaveBeenCalledWith(
      expect.objectContaining({ config: defaultProps.config, annotations: [] }),
      expect.objectContaining({})
    );
    expect(mockAnnotationsPlugin2).not.toHaveBeenCalled();
  });
  it.each([false, undefined])(`renders AnnotationsPlugin2 when annotationsClustering is %s`, (value) => {
    config.featureToggles.annotationsClustering = value;
    render(<AnnotationsPlugin {...defaultProps} />);
    expect(mockAnnotationsPlugin2).toHaveBeenCalledWith(
      expect.objectContaining({
        config: defaultProps.config,
        multiLane: undefined,
      }),
      expect.objectContaining({})
    );
    expect(mockAnnotationsPlugin2Cluster).not.toHaveBeenCalled();
  });
  it('passes multiLane from options to AnnotationsPlugin2 when clustering is disabled', () => {
    config.featureToggles.annotationsClustering = false;
    render(<AnnotationsPlugin {...defaultProps} options={{ multiLane: true }} />);
    expect(mockAnnotationsPlugin2).toHaveBeenCalledWith(
      expect.objectContaining({ multiLane: true }),
      expect.objectContaining({})
    );
  });
});
