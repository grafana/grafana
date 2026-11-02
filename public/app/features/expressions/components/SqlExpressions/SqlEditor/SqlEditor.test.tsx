import { render } from '@testing-library/react';

import { SqlEditor } from './SqlEditor';

let editorProps: Record<string, unknown> | undefined;

jest.mock('@grafana/ui/unstable', () => ({
  CodeMirrorEditor: (props: Record<string, unknown>) => {
    editorProps = props;
    return <div className="cm-scroller" />;
  },
  signatureHelp: jest.fn(),
}));

describe('SqlEditor', () => {
  beforeEach(() => {
    editorProps = undefined;
  });

  it('completes on space, so suggestions still open after FROM and in the SELECT list', () => {
    render(<SqlEditor value="SELECT * FROM " onChange={jest.fn()} completionProvider={{ tables: () => [] }} />);

    expect(editorProps?.completeOnSpace).toBe(true);
  });

  it('contains horizontal overscroll within the editor', () => {
    render(<SqlEditor value="SELECT * FROM A" onChange={jest.fn()} />);

    const overscrollRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find((rule) => rule.cssText.includes('cm-scroller') && rule.cssText.includes('overscroll-behavior-x'));

    expect(overscrollRule?.cssText).toContain('overscroll-behavior-x: contain');
  });
});
