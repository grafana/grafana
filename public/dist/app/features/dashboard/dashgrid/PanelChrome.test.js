import { PanelChrome } from './PanelChrome';
describe('PanelChrome', function () {
    var chrome;
    beforeEach(function () {
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
    it('Should replace a panel variable', function () {
        var out = chrome.replaceVariables('hello $aaa');
        expect(out).toBe('hello AAA');
    });
    it('But it should prefer the local variable value', function () {
        var extra = { aaa: { text: '???', value: 'XXX' } };
        var out = chrome.replaceVariables('hello $aaa and $bbb', extra);
        expect(out).toBe('hello XXX and BBB');
    });
});
//# sourceMappingURL=PanelChrome.test.js.map