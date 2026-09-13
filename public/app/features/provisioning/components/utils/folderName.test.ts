import { validateProvisionedFolderName } from './folderName';

describe('validateProvisionedFolderName', () => {
  it.each([
    { desc: 'letters, digits and spaces', name: 'My Team 2' },
    { desc: 'underscores and hyphens', name: 'my_team-2' },
    { desc: 'a single inner space', name: 'a b' },
  ])('accepts $desc', ({ name }) => {
    expect(validateProvisionedFolderName(name)).toBe(true);
  });

  it.each([
    { desc: 'an empty name', name: '', message: 'Folder name is required' },
    {
      desc: 'a forward slash, which would nest an unintended directory',
      name: 'team/reports',
      message:
        'Folder name contains invalid characters. Only letters, numbers, spaces, underscores, and hyphens are allowed.',
    },
    {
      desc: 'a dot, which the backend rejects for folder names',
      name: 'team.reports',
      message:
        'Folder name contains invalid characters. Only letters, numbers, spaces, underscores, and hyphens are allowed.',
    },
  ])('rejects $desc', ({ name, message }) => {
    expect(validateProvisionedFolderName(name)).toBe(message);
  });

  // The folder API trims the title it stores (pkg/registry/apis/folders/validate.go), but the
  // repository path is built in the frontend from the raw name, so a surrounding space commits a
  // directory Grafana will never agree with.
  describe('surrounding whitespace', () => {
    const message = 'Folder name cannot start or end with a space.';

    it.each([
      { desc: 'a trailing space', name: 'fsvv ' },
      { desc: 'a leading space', name: ' fsvv' },
      { desc: 'spaces on both sides', name: '  fsvv  ' },
      { desc: 'only spaces', name: '   ' },
    ])('rejects $desc', ({ name }) => {
      expect(validateProvisionedFolderName(name)).toBe(message);
    });
  });
});
