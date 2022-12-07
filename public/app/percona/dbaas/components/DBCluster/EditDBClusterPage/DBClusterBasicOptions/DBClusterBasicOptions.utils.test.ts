import { findDefaultDatabaseVersion } from './DBClusterBasicOptions.utils';

describe('DBClusterBasicOptions.utils::', () => {
  it('finds default database version', () => {
    const versions = [
      {
        label: 'db1',
        value: 'db1',
        default: false,
        disabled: false,
      },
      {
        label: 'db2',
        value: 'db2',
        default: true,
        disabled: false,
      },
    ];

    expect(findDefaultDatabaseVersion(versions)).toEqual(versions[1]);
  });
});
