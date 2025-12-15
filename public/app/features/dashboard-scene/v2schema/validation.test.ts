import {
  defaultPanelKind,
  defaultQueryGroupKind,
  defaultPanelQueryKind,
  defaultVizConfigKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { isPanelKindV2 } from './validation';

describe('v2schema validation', () => {
  it('isPanelKindV2 returns true for a minimal valid PanelKind', () => {
    const panel = defaultPanelKind();
    // Ensure minimal required properties exist (defaults should be fine)
    panel.spec.vizConfig = defaultVizConfigKind();
    panel.spec.data = defaultQueryGroupKind();

    expect(isPanelKindV2(panel)).toBe(true);
  });

  it('returns false when kind is not "Panel"', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error intentional invalid kind for test
    panel.kind = 'NotAPanel';
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when data kind is wrong', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error intentional invalid kind for test
    panel.spec.data = { kind: 'Wrong', spec: {} };
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when queries contain invalid entries', () => {
    const panel = defaultPanelKind();
    panel.spec.data = defaultQueryGroupKind();
    // @ts-expect-error push an invalid query shape
    panel.spec.data.spec.queries = [{}];
    expect(isPanelKindV2(panel)).toBe(false);

    // Ensure a valid query shape passes
    panel.spec.data.spec.queries = [defaultPanelQueryKind()];
    expect(isPanelKindV2(panel)).toBe(true);
  });

  it('returns false when vizConfig.group is not a string', () => {
    const panel = defaultPanelKind();
    panel.spec.vizConfig = defaultVizConfigKind();
    // @ts-expect-error force wrong type
    panel.spec.vizConfig.group = 42;
    expect(isPanelKindV2(panel)).toBe(false);
  });

  it('returns false when transparent is not a boolean', () => {
    const panel = defaultPanelKind();
    // @ts-expect-error wrong type
    panel.spec.transparent = 'yes';
    expect(isPanelKindV2(panel)).toBe(false);
  });
});
