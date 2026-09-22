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

describe('NotebookPdfLayout', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('sizes the document to a portrait sheet with a canvas of its own', () => {
    render(<NotebookPdfLayout />);

    const rule = ruleFor('html,body');
    // The width has to land on html/body because that is what the renderer measures; constraining
    // something further in leaves the document as wide as it ever was.
    expect(rule).toContain('210mm');
    expect(rule).toMatch(/background:\s*#/);
    // Emphatically NOT the inset: padding on html and body both doubles it, and the base styles pin
    // `body { padding-right: 0 !important }`, so only the left side would double.
    expect(rule).not.toContain('padding');
  });

  // Applied once, on a container that spans the sheet, so the left and right insets match.
  it('insets the page exactly once, on the document column', () => {
    render(<NotebookPdfLayout />);

    const rule = ruleFor('notebook-document');
    expect(rule).toContain('max-width: none');
    expect(rule).toMatch(/padding:\s*12mm/);
  });

  // The only lever a headless-Chrome PDF engine consults for physical page shape.
  it('declares the page size, with no page margin', () => {
    render(<NotebookPdfLayout />);

    const rule = injectedRules().find((r) => r.startsWith('@page'));
    expect(rule).toContain('210mm 297mm');
    expect(rule).toMatch(/margin:\s*0/);
  });

  // Fragmentation drops margins at a break but draws padding, so this is what keeps the cell after a
  // page break off the paper's edge — the body's own padding is spent at the start and end of the
  // whole flow, not per page.
  it('gives each cell a leading inset, so a cell that begins a page is not flush', () => {
    render(<NotebookPdfLayout />);

    expect(ruleFor('notebook-cell-content')).toMatch(/padding-top:\s*4mm/);
  });

  // Whichever token the theme currently calls the page's own surface — the point is that the sheet
  // carries the notebook's canvas rather than bare paper, so the white panels have something to sit
  // on, exactly as they do on screen.
  it.each([true, false])('paints the canvas with the page background (visual refresh: %s)', async (refresh) => {
    await act(async () => {
      setTestFlags({ [VISUAL_REFRESH_FLAG]: refresh });
    });

    render(<NotebookPdfLayout />);

    expect(ruleFor('html,body')).toMatch(/background:\s*#/);
  });

  // It used to need them, back when this ran on the ordinary notebook route and had to outrank the
  // page shell's own styling. The render route mounts no shell, so anything still shouting here
  // would be a sign the route had stopped owning its own page.
  it('needs no !important, because the render route owns the page', () => {
    render(<NotebookPdfLayout />);

    const own = injectedRules().filter(
      (rule) =>
        rule.includes('html,body') || rule.includes('notebook-cell-content') || rule.includes('notebook-document')
    );

    expect(own.length).toBeGreaterThan(0);
    expect(own.join('\n')).not.toContain('!important');
  });
});
