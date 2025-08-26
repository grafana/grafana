import { determineAdvancedMode } from './useAdvancedMode';

describe('determineAdvancedMode', () => {
  it('should return true if simplifiedQueryEditor is false', () => {
    const isGrafanaAlertingType = true;

    const result = determineAdvancedMode(false, isGrafanaAlertingType);

    expect(result).toBe(true);
  });

  it('should return true if isGrafanaAlertingType is false', () => {
    const isGrafanaAlertingType = false;

    const result = determineAdvancedMode(true, isGrafanaAlertingType);

    expect(result).toBe(true);
  });

  it('should return false if all conditions are false', () => {
    const isGrafanaAlertingType = true;

    const result = determineAdvancedMode(true, isGrafanaAlertingType);

    expect(result).toBe(false);
  });
});
