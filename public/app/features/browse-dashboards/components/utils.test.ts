import { formatFolderName } from './utils';

describe('formatFolderName', () => {
  it('should handle empty string', () => {
    expect(formatFolderName('')).toBe('');
  });

  it('should convert uppercase to lowercase', () => {
    expect(formatFolderName('MyFolder')).toBe('myfolder');
    expect(formatFolderName('UPPERCASE')).toBe('uppercase');
    expect(formatFolderName('MiXeD cAsE')).toBe('mixed-case');
  });

  it('should replace whitespace with hyphens', () => {
    expect(formatFolderName('folder name')).toBe('folder-name');
    expect(formatFolderName('folder  name')).toBe('folder-name'); // multiple spaces
    expect(formatFolderName('folder\tname')).toBe('folder-name'); // tab
    expect(formatFolderName('folder\nname')).toBe('folder-name'); // newline
    expect(formatFolderName('  folder name  ')).toBe('folder-name'); // leading/trailing spaces
  });

  it('should remove special characters', () => {
    expect(formatFolderName('folder@name')).toBe('foldername');
    expect(formatFolderName('folder!@#$%^&*()name')).toBe('foldername');
    expect(formatFolderName('folder_name')).toBe('foldername');
    expect(formatFolderName('folder.name')).toBe('foldername');
    expect(formatFolderName('folder/name')).toBe('foldername');
  });

  it('should preserve numbers and hyphens', () => {
    expect(formatFolderName('folder-123')).toBe('folder-123');
    expect(formatFolderName('folder123')).toBe('folder123');
    expect(formatFolderName('123-folder')).toBe('123-folder');
    expect(formatFolderName('folder-name-123')).toBe('folder-name-123');
  });

  it('should handle complex mixed cases', () => {
    expect(formatFolderName('My Folder @2023!')).toBe('my-folder-2023');
    expect(formatFolderName('  FOLDER_NAME  with-123  ')).toBe('foldername-with-123');
    expect(formatFolderName('Test@Folder#Name$123')).toBe('testfoldername123');
    expect(formatFolderName('Multiple   Spaces   Between')).toBe('multiple-spaces-between');
  });

  it('should handle strings with only special characters', () => {
    expect(formatFolderName('!@#$%^&*()')).toBe('');
    expect(formatFolderName('___')).toBe('');
    expect(formatFolderName('...')).toBe('');
  });

  it('should handle strings with only whitespace', () => {
    expect(formatFolderName('   ')).toBe('');
    expect(formatFolderName('\t\n\r')).toBe('');
  });

  it('should handle already formatted names', () => {
    expect(formatFolderName('already-formatted')).toBe('already-formatted');
    expect(formatFolderName('folder123')).toBe('folder123');
    expect(formatFolderName('test-folder-name-123')).toBe('test-folder-name-123');
  });
});
