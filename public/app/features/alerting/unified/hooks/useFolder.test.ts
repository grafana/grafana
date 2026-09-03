import { mockFolder } from '../mocks';

import { stringifyFolder } from './useFolder';

describe('with slashes', () => {
  it('should correctly stringify a folder', () => {
    const folder = mockFolder({ title: 'my/folder' });
    expect(stringifyFolder(folder)).toEqual('my\\/folder');
  });

  it('should correctly stringify a nested folder', () => {
    const folder = mockFolder({ title: 'my/folder', parents: [mockFolder({ title: 'parent/slash' })] });
    expect(stringifyFolder(folder)).toEqual('parent\\/slash/my\\/folder');
  });
});

describe('with backslashes', () => {
  it('should escape a backslash in the title', () => {
    const folder = mockFolder({ title: 'my\\folder' });
    expect(stringifyFolder(folder)).toEqual('my\\\\folder');
  });

  it('should escape a nested folder whose parent title ends in a backslash', () => {
    // "team\" must become "team\\" so it does not merge with the following separator when parsed
    const folder = mockFolder({ title: 'alerts', parents: [mockFolder({ title: 'team\\' })] });
    expect(stringifyFolder(folder)).toEqual('team\\\\/alerts');
  });
});

describe('without slashes', () => {
  it('should correctly stringify a folder', () => {
    const folder = mockFolder({ title: 'my folder' });
    expect(stringifyFolder(folder)).toEqual('my folder');
  });

  it('should correctly stringify a nested folder', () => {
    const folder = mockFolder({ title: 'my folder', parents: [mockFolder({ title: 'my parent' })] });
    expect(stringifyFolder(folder)).toEqual('my parent/my folder');
  });
});
