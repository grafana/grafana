import { splitFolderPath } from './legacyGroupsApi';

describe('splitFolderPath', () => {
  it.each([
    { file: 'Payments/us-east', titles: ['Payments', 'us-east'] },
    { file: 'Payments/a\\/b', titles: ['Payments', 'a/b'] },
    { file: 'ends with\\\\/child', titles: ['ends with\\', 'child'] },
    { file: 'team\\ops', titles: ['team\\ops'] },
  ])('splits $file into its folder titles', ({ file, titles }) => {
    expect(splitFolderPath(file)).toEqual(titles);
  });
});
