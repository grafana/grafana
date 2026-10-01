import { saveAs } from 'file-saver';

import { downloadMarkdown } from './downloadMarkdown';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const mockSaveAs = jest.mocked(saveAs);

describe('downloadMarkdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function savedFilename(): string {
    const [, filename] = mockSaveAs.mock.calls[0];
    return String(filename);
  }

  it('saves the markdown as a .md file', async () => {
    downloadMarkdown('# Notebook\n\nBody', 'Q2 latency regression');

    const [blob] = mockSaveAs.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- saveAs is called with a Blob
    expect(await (blob as Blob).text()).toBe('# Notebook\n\nBody');
    expect(savedFilename()).toMatch(/^q2-latency-regression-.*\.md$/);
  });

  it('slugs the title so the filename is safe', () => {
    downloadMarkdown('body', 'Checkout: errors / spike!');

    expect(savedFilename()).toMatch(/^checkout-errors-spike-/);
  });

  it('caps a long title without leaving a trailing separator', () => {
    downloadMarkdown('body', `${'a'.repeat(58)} bbbb`);

    const slug = savedFilename().split('-2')[0];
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to a generic name when the title slugs to nothing', () => {
    // An emoji-only or punctuation-only title would otherwise produce a file called just '-<date>.md'.
    downloadMarkdown('body', '!!!');

    expect(savedFilename()).toMatch(/^notebook-/);
  });
});
