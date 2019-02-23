import { parsePanelRefFromPath } from './PanelReference';

describe('given referenced panels', () => {
  it('should parse reference from URL', () => {
    const url = 'http://localhost:3000/d/f7fsrtrmk/copy-test?orgId=1&fullscreen&edit&panelId=2';

    const ref = parsePanelRefFromPath(url);
    expect(ref.dashboard).toBe('f7fsrtrmk');
    expect(ref.panelId).toBe(2);
  });
});
