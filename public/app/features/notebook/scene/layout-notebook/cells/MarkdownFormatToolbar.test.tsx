import { createRef } from 'react';
import { render, screen } from 'test/test-utils';

import { MARKDOWN_FORMAT_TOOLBAR_TEST_ID, MarkdownFormatToolbar } from './MarkdownFormatToolbar';

// The toolbar's real behavior (finding the live CM6 EditorView via EditorView.findFromDOM, reading its
// selection, positioning against view.coordsAtPos) all depend on a real, laid-out CodeMirror instance,
// which does not run in jsdom (see CodeCell.test.tsx). What's left testable at this level is the
// presentational contract: given no view to find, the toolbar renders nothing rather than erroring —
// the rest (appearing on selection, active-state buttons, dismissal) needs manual QA or Playwright.
describe('MarkdownFormatToolbar', () => {
  it('renders nothing when its container has no mounted editor to find', () => {
    const editorContainerRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div>
        <div ref={editorContainerRef} />
        <MarkdownFormatToolbar editorContainerRef={editorContainerRef} />
      </div>
    );

    expect(screen.queryByTestId(MARKDOWN_FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('renders nothing before the container ref has anything attached', () => {
    const editorContainerRef = createRef<HTMLDivElement>();

    render(<MarkdownFormatToolbar editorContainerRef={editorContainerRef} />);

    expect(screen.queryByTestId(MARKDOWN_FORMAT_TOOLBAR_TEST_ID)).not.toBeInTheDocument();
  });
});
