import { render } from '@testing-library/react';

import { SqlEditor } from './SqlEditor';

jest.mock('@grafana/ui/unstable', () => ({
  CodeMirrorEditor: () => <div className="cm-scroller" />,
  signatureHelp: jest.fn(),
}));

describe('SqlEditor', () => {
  it('contains horizontal overscroll within the editor', () => {
    render(<SqlEditor value="SELECT * FROM A" onChange={jest.fn()} />);

    const overscrollRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find((rule) => rule.cssText.includes('cm-scroller') && rule.cssText.includes('overscroll-behavior-x'));

    expect(overscrollRule?.cssText).toContain('overscroll-behavior-x: contain');
  });
});
