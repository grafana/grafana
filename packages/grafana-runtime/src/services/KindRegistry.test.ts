import { kindLabel } from './KindRegistry';

describe('kindLabel', () => {
  it.each([
    {
      desc: 'with its first letter uppercased by default',
      label: 'weekly report',
      options: undefined,
      expected: 'Weekly report',
    },
    {
      desc: 'as it reads inside a sentence on request',
      label: 'weekly report',
      options: { upperFirst: false },
      expected: 'weekly report',
    },
    {
      desc: 'still capitalized inside a sentence when the language capitalizes it',
      label: 'Seite',
      options: { upperFirst: false },
      expected: 'Seite',
    },
  ])('gives the label $desc', ({ label, options, expected }) => {
    expect(kindLabel(() => label)(options)).toBe(expected);
  });

  it('reads the label on each call, so a kind declared before its translations load is still translated', () => {
    let translation = 'page';
    const getLabel = kindLabel(() => translation);
    expect(getLabel()).toBe('Page');

    translation = 'Seite';

    expect(getLabel()).toBe('Seite');
  });
});
