import { type ReviewSummary } from '../types';

import {
  checkCompleteness,
  collectClaims,
  collectTexts,
  diffPathKeys,
  findRawPathTexts,
  isComplete,
} from './completeness';

function summary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    mode: 'save',
    baselineKind: 'saved',
    overview: { line: '', counts: { added: 0, changed: 0, removed: 0, moved: 0 } },
    tree: [],
    metadata: [],
    systemDefaults: [],
    bookkeeping: [],
    collapsePanelsByDefault: false,
    ...overrides,
  };
}

describe('checkCompleteness', () => {
  const claim = (path: string, owner = 'x') => ({ claim: path, owner });

  it('accepts paths covered once, by an equal claim or a prefix claim', () => {
    const report = checkCompleteness(
      ['title', 'elements/panel-1/spec/title', 'elements/panel-1/spec/id'],
      [claim('title'), claim('elements/panel-1/spec')]
    );

    expect(isComplete(report)).toBe(true);
  });

  it('does not treat a claim as covering a sibling that shares its prefix', () => {
    const report = checkCompleteness(['elements/panel-10/spec/title'], [claim('elements/panel-1')]);

    expect(report.uncovered).toEqual(['elements/panel-10/spec/title']);
    expect(report.phantom).toEqual([claim('elements/panel-1')]);
  });

  it('reports paths covered by more than one claim, with the claims', () => {
    const report = checkCompleteness(
      ['layout/spec/items/0/spec/x'],
      [claim('layout/spec/items/0', 'a'), claim('layout', 'b')]
    );

    expect(report.doubleCovered).toEqual([
      { path: 'layout/spec/items/0/spec/x', claims: [claim('layout/spec/items/0', 'a'), claim('layout', 'b')] },
    ]);
  });

  it('reports the same claim made twice as double coverage', () => {
    const report = checkCompleteness(['title'], [claim('title', 'a'), claim('title', 'b')]);

    expect(report.doubleCovered).toHaveLength(1);
  });
});

describe('diffPathKeys', () => {
  it('flattens the grouped diffs and keeps JSON-pointer escapes', () => {
    const diff = { op: 'replace' as const, value: 1, originalValue: 0, startLineNumber: 0, endLineNumber: 0 };

    expect(
      diffPathKeys({
        title: [{ ...diff, path: ['title'] }],
        elements: [{ ...diff, path: ['elements', 'api~1errors', 'spec', 'title'] }],
      })
    ).toEqual(['title', 'elements/api~1errors/spec/title']);
  });
});

describe('collectClaims', () => {
  it('gathers node, change, system default and bookkeeping claims, including nested sections', () => {
    const result = collectClaims(
      summary({
        tree: [
          {
            kind: 'section',
            sectionKind: 'row',
            id: 's1',
            label: "'API' row",
            summary: '',
            claims: ['layout/spec/rows/0'],
            categories: [],
            children: [
              {
                kind: 'panel',
                id: 'p1',
                label: "'Errors'",
                summary: 'properties',
                claims: [],
                categories: [
                  {
                    category: 'properties',
                    label: 'Properties',
                    changes: [{ kind: 'changed', text: 'Title: a → b', claims: ['elements/panel-1/spec/title'] }],
                  },
                ],
              },
            ],
          },
        ],
        systemDefaults: [
          {
            label: "'Errors'",
            changes: [
              {
                kind: 'added',
                text: 'Plugin version: set to 11.0.0',
                claims: ['elements/panel-1/spec/vizConfig/version'],
              },
            ],
          },
        ],
        bookkeeping: ['revision'],
      })
    );

    expect(result.map(({ claim }) => claim)).toEqual([
      'layout/spec/rows/0',
      'elements/panel-1/spec/title',
      'elements/panel-1/spec/vizConfig/version',
      'revision',
    ]);
  });
});

describe('findRawPathTexts', () => {
  it('flags texts that leak spec paths and keeps human labels', () => {
    const texts = collectTexts(
      summary({
        overview: { line: 'Changes to 1 panel', counts: { added: 0, changed: 1, removed: 0, moved: 0 } },
        metadata: [
          { kind: 'changed', text: 'Legend › Mode: list → table', claims: [] },
          { kind: 'changed', text: 'vizConfig.spec.options.legend.displayMode: list → table', claims: [] },
          { kind: 'changed', text: 'elements/panel-1/spec/title: a → b', claims: [] },
        ],
      })
    );

    expect(findRawPathTexts(texts)).toEqual([
      'vizConfig.spec.options.legend.displayMode: list → table',
      'elements/panel-1/spec/title: a → b',
    ]);
  });
});
