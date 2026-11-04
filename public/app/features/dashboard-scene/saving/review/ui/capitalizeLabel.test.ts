import { capitalizeLabel } from './capitalizeLabel';

describe('capitalizeLabel()', () => {
  test.each([
    { label: "the 2nd unnamed panel in the 'DB' tab", expected: "The 2nd unnamed panel in the 'DB' tab" },
    { label: 'élan panel', expected: 'Élan panel' },
    { label: "'cpu usage'", expected: "'cpu usage'" },
    { label: '2nd row', expected: '2nd row' },
    { label: 'Dashboard', expected: 'Dashboard' },
    { label: '', expected: '' },
  ])('when the label is "$label", it becomes "$expected"', ({ label, expected }) => {
    expect(capitalizeLabel(label)).toBe(expected);
  });
});
