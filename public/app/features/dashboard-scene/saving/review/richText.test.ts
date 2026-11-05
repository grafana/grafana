import { t } from '@grafana/i18n';

import { asSelf, joinPath, named, noEscape, rich, richToPlain } from './richText';

describe('rich', () => {
  const row = named('row', 'New row');
  const tab = named('tab', 'Tab 1');

  it('splices named elements into the translated sentence', () => {
    const text = rich({ name: [row], parent: [tab] }, (p) =>
      t('dashboard-scene.review.node.added-under', 'Added {{name}} under {{parent}}', { ...p, interpolation: noEscape })
    );

    expect(text).toEqual(['Added ', row, ' under ', tab]);
  });

  it('follows a translation that reorders the parts', () => {
    // A language that names the parent first
    const text = rich({ name: [row], parent: [tab] }, (p) => `Under ${p.parent}, added ${p.name}`);

    expect(text).toEqual(['Under ', tab, ', added ', row]);
  });

  it('keeps string parts as text and merges them with the text around', () => {
    expect(rich({ name: 'CPU', position: '2' }, (p) => `${p.name} at position ${p.position}`)).toEqual([
      'CPU at position 2',
    ]);
  });

  it('keeps titles as typed, without escaping', () => {
    const text = rich({ name: [named('panel', 'A & <B>')] }, (p) => p.name);

    expect(richToPlain(text)).toBe('Panel "A & <B>"');
  });
});

describe('richToPlain', () => {
  it('names each element by its kind word, the header own node included', () => {
    const path = joinPath([named('tab', 'Cluster')], [named('row', '')]);

    expect(richToPlain(asSelf(path))).toBe('Tab "Cluster" › Row (unnamed)');
  });
});
