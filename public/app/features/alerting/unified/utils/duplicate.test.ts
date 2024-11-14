import { generateCopiedName } from './duplicate';

describe('generateCopiedName', () => {
  it('should generate copy name', () => {
    const fileName = 'my file';
    const expectedDuplicateName = 'my file (copy)';

    expect(generateCopiedName(fileName, [])).toEqual(expectedDuplicateName);
  });

  it('should generate copy name and number from original file', () => {
    const fileName = 'my file';
    const duplicatedName = 'my file (copy)';
    const expectedDuplicateName = 'my file (copy 2)';

    expect(generateCopiedName(fileName, [fileName, duplicatedName])).toEqual(expectedDuplicateName);
  });

  it('should generate copy name and number from duplicated file', () => {
    const fileName = 'my file (copy)';
    const duplicatedName = 'my file (copy 2)';
    const expectedDuplicateName = 'my file (copy 3)';

    expect(generateCopiedName(fileName, [fileName, duplicatedName])).toEqual(expectedDuplicateName);
  });

  it('should generate copy name and number from duplicated file in gap', () => {
    const fileName = 'my file (copy)';
    const duplicatedName = 'my file (copy 3)';
    const expectedDuplicateName = 'my file (copy 2)';

    expect(generateCopiedName(fileName, [fileName, duplicatedName])).toEqual(expectedDuplicateName);
  });
});
