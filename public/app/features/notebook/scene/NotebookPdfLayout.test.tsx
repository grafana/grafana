import { act, render } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { NotebookPdfLayout } from './NotebookPdfLayout';

const VISUAL_REFRESH_FLAG = 'grafana.visualDesignRefresh';

/**
 * Reads the live CSSOM rather than each `<style>` tag's textContent: emotion's "speedy" insertion
 * mode writes rules straight to the sheet via insertRule, leaving textContent empty.
 */
function injectedRules(): string[] {
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText);
    } catch {
      return [];
    }
  });
}

function ruleFor(selector: string): string | undefined {
  // stylis drops the space after a comma, hence `html,body` rather than `html, body`.
  return injectedRules().find((rule) => rule.includes(selector));
}

function pageRule(): string | undefined {
  return injectedRules().find((rule) => rule.startsWith('@page'));
}

describe('NotebookPdfLayout', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('sizes the document to a portrait sheet with a canvas of its own', () => {
    render(<NotebookPdfLayout />);

    const rule = ruleFor('html,body');
    expect(rule).toContain('210mm');
    expect(rule).toMatch(/background:\s*#/);
    // The inset goes on the document column instead: padding on html and body both doubles it, and
    // the base styles pin `body { padding-right: 0 !important }`, so only the left would double.
    expect(rule).not.toContain('padding');
  });

  // Horizontal only, and once, so the left and right insets match. Vertically it is the page margin.
  it('insets the page sides exactly once, on the document column', () => {
    render(<NotebookPdfLayout />);

    const rule = ruleFor('notebook-document');
    expect(rule).toContain('max-width: none');
    expect(rule).toMatch(/padding:\s*0(px)? 12mm/);
  });

  // The regression behind the clipped single-visualisation export: Chromium sizes a print layout
  // from the content's intrinsic width, where a cap is not a floor, so a notebook holding only a
  // chart shrank to the width of its title and the chart overflowed. jsdom does no layout, so this
  // pins the declaration, not the geometry.
  it.each(['html,body', 'notebook-document'])('gives %s a definite width, not just a cap', (selector) => {
    render(<NotebookPdfLayout />);

    // The negative lookbehind is the point: `max-width: 210mm` would satisfy a bare `toContain`.
    expect(ruleFor(selector)).toMatch(/(?<!max-)width:\s*210mm/);
  });

  // The regression behind text sitting flush against the bottom of a page. A page margin is the only
  // inset a break sees — a box's own vertical padding is spent once per flow, not per page.
  it('holds the document off the paper on every page, via the page margin', () => {
    render(<NotebookPdfLayout />);

    expect(pageRule()).toContain('210mm 297mm');
    expect(pageRule()).toMatch(/margin:\s*12mm 0(px)?/);
  });

  // What makes that margin usable: the canvas background stops at the page area, so without this the
  // margin prints as bare paper and the sheet comes out two colours.
  it('carries the canvas colour through the page margin, so one sheet is one colour', () => {
    render(<NotebookPdfLayout />);

    const canvas = /background:\s*(#[0-9a-f]+)/i.exec(ruleFor('html,body') ?? '')?.[1];
    expect(canvas).toBeDefined();
    // The same colour as the document, or the seam shows at the margin.
    expect(pageRule()).toContain(canvas);
  });

  // Whichever token the theme currently calls the page's own surface.
  it.each([true, false])('paints the canvas with the page background (visual refresh: %s)', async (refresh) => {
    await act(async () => {
      setTestFlags({ [VISUAL_REFRESH_FLAG]: refresh });
    });

    render(<NotebookPdfLayout />);

    expect(ruleFor('html,body')).toMatch(/background:\s*#/);
    expect(pageRule()).toMatch(/background:\s*#/);
  });

  // These are the page's own styles, not overrides fighting a shell that outranks them — the render
  // route mounts none. Anything shouting here would mean that stopped being true.
  it('needs no !important, because the render route owns the page', () => {
    render(<NotebookPdfLayout />);

    const own = injectedRules().filter((rule) => rule.includes('html,body') || rule.includes('notebook-document'));

    expect(own.length).toBeGreaterThan(0);
    expect(own.join('\n')).not.toContain('!important');
  });
});
