import { PanelChrome } from './PanelChrome';

describe('PanelChrome', () => {
  let chrome: PanelChrome;

  beforeEach(() => {
    chrome = new PanelChrome({
      panel: {
        scopedVars: {
          aaa: { value: 'AAA', text: 'upperA' },
          bbb: { value: 'BBB', text: 'upperB' },
        },
      },
      isFullscreen: false,
    } as any);
  });

  it('Should replace a panel variable', () => {
    const out = chrome.replaceVariables('hello $aaa');
    expect(out).toBe('hello AAA');
  });

  it('But it should prefer the local variable value', () => {
    const extra = { aaa: { text: '???', value: 'XXX' } };
    const out = chrome.replaceVariables('hello $aaa and $bbb', extra);
    expect(out).toBe('hello XXX and BBB');
  });
});
