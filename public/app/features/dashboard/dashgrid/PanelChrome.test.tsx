import { PanelChrome } from './PanelChrome';

jest.mock('sass/_variables.generated.scss', () => ({
  panelhorizontalpadding: 10,
  panelVerticalPadding: 10,
}));

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
      dashboard: {},
      plugin: {},
      isFullscreen: false,
    });
  });

  it('Should replace a panel variable', () => {
    const out = chrome.replaceVariables('hello $aaa');
    expect(out).toBe('hello AAA');
  });

  it('It should prefer the diret variables', () => {
    const extra = { aaa: { text: '???', value: 'XXX' } };
    const out = chrome.replaceVariables('hello $aaa and $bbb', extra);
    expect(out).toBe('hello XXX and BBB');
  });
});
