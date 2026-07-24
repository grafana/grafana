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
