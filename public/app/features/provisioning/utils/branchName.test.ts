import { type BranchTemplateVars, generateBranchToken, renderBranchName, sanitizeBranchName } from './branchName';
import { validateBranchName } from './git';

const vars: BranchTemplateVars & { random: string } = {
  action: 'create',
  resourceKind: 'dashboard',
  title: 'My Dash!',
  userLogin: 'ada',
  random: 'x7k2mq',
};

describe('renderBranchName', () => {
  it('substitutes variables and sanitises the result into a valid ref', () => {
    expect(renderBranchName('grafana/{{action}}-{{title}}-{{random}}', vars)).toBe('grafana/create-my-dash-x7k2mq');
  });

  it('substitutes userLogin and resourceKind', () => {
    expect(renderBranchName('{{userLogin}}/{{resourceKind}}-{{action}}', vars)).toBe('ada/dashboard-create');
  });

  it.each([undefined, null, '', '   '])('returns an empty string for a blank template (%p)', (template) => {
    expect(renderBranchName(template, vars)).toBe('');
  });

  it('leaves unrecognised variables as literal text and sanitises them', () => {
    // {{nope}} is not a known key, so it is left as literal text and then sanitised; the '/{{' run
    // collapses to a single '/', so no segment is left starting with a dash.
    const result = renderBranchName('feat/{{action}}/{{nope}}', vars);
    expect(result).toBe('feat/create/nope');
    expect(validateBranchName(result)).toBeTruthy();
  });
});

describe('sanitizeBranchName', () => {
  it.each([
    ['Feature/My Branch', 'feature/my-branch'],
    ['foo//bar', 'foo/bar'],
    ['foo--bar', 'foo-bar'],
    ['foo..bar', 'foo-bar'],
    ['/leading/and/trailing/', 'leading/and/trailing'],
    ['-dash-wrapped-', 'dash-wrapped'],
    ['UPPER_Case-123', 'upper_case-123'],
    ['weird@{name}', 'weird-name'],
    ['foo/-/bar', 'foo/bar'],
    ['foo-/bar', 'foo/bar'],
    ['foo/-bar', 'foo/bar'],
  ])('sanitises %p to %p', (input, expected) => {
    const result = sanitizeBranchName(input);
    expect(result).toBe(expected);
    expect(validateBranchName(result)).toBeTruthy();
  });

  it('truncates to 100 characters with no trailing separator', () => {
    const result = sanitizeBranchName('a'.repeat(150));
    expect(result).toHaveLength(100);
    expect(validateBranchName(result)).toBeTruthy();
  });

  it('does not leave a trailing separator after truncation', () => {
    // Char at index 99 is a '-', so the post-slice trim must remove it.
    const result = sanitizeBranchName('a'.repeat(99) + '-bcd');
    expect(result).toBe('a'.repeat(99));
    expect(validateBranchName(result)).toBeTruthy();
  });

  it('returns an empty string when nothing valid remains', () => {
    expect(sanitizeBranchName('!!!')).toBe('');
  });
});

describe('generateBranchToken', () => {
  it('produces a 6-char lowercase alphanumeric token by default', () => {
    expect(generateBranchToken()).toMatch(/^[a-z0-9]{6}$/);
  });

  it('honours the requested length', () => {
    expect(generateBranchToken(10)).toMatch(/^[a-z0-9]{10}$/);
  });

  it('is deterministic for a fixed Math.random', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      // Math.floor(0 * 36) === 0 -> first letter of the alphabet for every position.
      expect(generateBranchToken()).toBe('aaaaaa');
    } finally {
      spy.mockRestore();
    }
  });
});
