import { PanelProps } from '@grafana/data';

import { Options } from './panelcfg.gen';
import { useDashListUrlParams } from './utils';

// Mock the dependencies
jest.mock('../../../core/hooks/useBusEvent', () => ({
  useBusEvent: jest.fn(),
}));

describe('useDashListUrlParams', () => {
  const createPanelProps = (keepTime: boolean, includeVars: boolean): PanelProps<Options> =>
    ({
      options: {
        keepTime,
        includeVars,
      },
      replaceVariables: (str) => str,
    }) as PanelProps<Options>;

  it('should not add any parameters when both keepTime and includeVars are false', () => {
    const props = createPanelProps(false, false);
    expect(useDashListUrlParams(props)).toBe('');
  });

  it('should add both parameters when both keepTime and includeVars are true in correct format', () => {
    const props = createPanelProps(true, true);
    // Normally this would be interpolated but we mocked that function so we just check if the variables are correct
    // in the string.
    expect(useDashListUrlParams(props)).toBe('?$__url_time_range&$__all_variables');
  });
});
