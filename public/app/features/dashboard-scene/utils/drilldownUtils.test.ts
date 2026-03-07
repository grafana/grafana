import { DataSourceRef } from '@grafana/schema';

import { VizPanelSubHeader } from '../scene/VizPanelSubHeader';

import { verifyDrilldownApplicability } from './drilldownUtils';

describe('verifyDrilldownApplicability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true when applicability is enabled and datasources match', () => {
    const subHeader = new VizPanelSubHeader({});

    const result = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-1' } as DataSourceRef,
      true
    );

    expect(result).toBe(true);
  });

  it('returns false when datasources differ or applicability disabled', () => {
    const subHeader = new VizPanelSubHeader({});

    const mismatch = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-2' } as DataSourceRef,
      true
    );

    expect(mismatch).toBe(false);

    const disabled = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-1' } as DataSourceRef,
      false
    );

    expect(disabled).toBe(false);
  });
});
