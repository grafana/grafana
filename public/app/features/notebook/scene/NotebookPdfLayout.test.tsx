import { act, render } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { NotebookPdfLayout } from './NotebookPdfLayout';

const VISUAL_REFRESH_FLAG = 'grafana.visualDesignRefresh';

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
    expect(rule).not.toContain('padding');
  });

  it('insets the page sides exactly once, on the document column', () => {
    render(<NotebookPdfLayout />);

    const rule = ruleFor('notebook-document');
    expect(rule).toContain('max-width: none');
    expect(rule).toMatch(/padding:\s*0(px)? 12mm/);
  });

  it.each(['html,body', 'notebook-document'])('gives %s a definite width, not just a cap', (selector) => {
    render(<NotebookPdfLayout />);

    expect(ruleFor(selector)).toMatch(/(?<!max-)width:\s*210mm/);
  });

  it('holds the document off the paper on every page, via the page margin', () => {
    render(<NotebookPdfLayout />);

    expect(pageRule()).toContain('210mm 297mm');
    expect(pageRule()).toMatch(/margin:\s*12mm 0(px)?/);
  });

  it('carries the canvas colour through the page margin, so one sheet is one colour', () => {
    render(<NotebookPdfLayout />);

    const canvas = /background:\s*(#[0-9a-f]+)/i.exec(ruleFor('html,body') ?? '')?.[1];
    expect(canvas).toBeDefined();
    expect(pageRule()).toContain(canvas);
  });

  it.each([true, false])('paints the canvas with the page background (visual refresh: %s)', async (refresh) => {
    await act(async () => {
      setTestFlags({ [VISUAL_REFRESH_FLAG]: refresh });
    });

    render(<NotebookPdfLayout />);

    expect(ruleFor('html,body')).toMatch(/background:\s*#/);
    expect(pageRule()).toMatch(/background:\s*#/);
  });

  it('needs no !important, because the render route owns the page', () => {
    render(<NotebookPdfLayout />);

    const own = injectedRules().filter((rule) => rule.includes('html,body') || rule.includes('notebook-document'));

    expect(own.length).toBeGreaterThan(0);
    expect(own.join('\n')).not.toContain('!important');
  });
  it('keeps a cell off a page boundary, so a break goes before it rather than through it', () => {
    render(<NotebookPdfLayout />);

    expect(ruleFor('notebook-cell-content {')).toMatch(/break-inside:\s*avoid/);
  });

  it('keeps a heading with what follows it', () => {
    render(<NotebookPdfLayout />);

    expect(ruleFor('notebook-cell-content :is(h1')).toMatch(/break-after:\s*avoid/);
  });
});
