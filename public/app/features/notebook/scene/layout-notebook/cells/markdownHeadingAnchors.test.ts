import { addHeadingIds, slugifyHeading } from './markdownHeadingAnchors';

function idsIn(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => heading.id);
}

describe('slugifyHeading', () => {
  it.each([
    ['Table of Contents', 'table-of-contents'],
    ['Sun & Wind Assessment', 'sun--wind-assessment'],
    ['Choosing the Right Containers', 'choosing-the-right-containers'],
    ['Top Starter Plants', 'top-starter-plants'],
    ['C# notes', 'c-notes'],
  ])('turns %j into %j the way GitHub does', (text, slug) => {
    expect(slugifyHeading(text)).toBe(slug);
  });
});

describe('addHeadingIds', () => {
  it('gives every heading its slug as an id', () => {
    const html = '<h1>Container Gardening</h1><p>intro</p><h2>Table of Contents</h2><h3>Herbs</h3>';

    expect(idsIn(addHeadingIds(html))).toEqual(['container-gardening', 'table-of-contents', 'herbs']);
  });

  it('reads the heading text, not its markup, when building the slug', () => {
    const html = '<h2><strong>Bold</strong> title</h2>';

    expect(idsIn(addHeadingIds(html))).toEqual(['bold-title']);
  });

  it('suffixes repeated headings so the second one is still linkable', () => {
    const html = '<h2>Notes</h2><h2>Notes</h2>';

    expect(idsIn(addHeadingIds(html))).toEqual(['notes', 'notes-1']);
  });

  it('leaves a heading that has no letters or digits alone', () => {
    const html = '<h2>!!!</h2>';

    expect(idsIn(addHeadingIds(html))).toEqual(['']);
  });
});
