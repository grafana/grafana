import React from 'react';
import { shallow } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { StorageLocationDetails } from './StorageLocationDetails';
import { LocationType, S3Location, StorageLocation } from '../StorageLocations.types';
import { DescriptionBlock } from '../../DescriptionBlock';
import { KeysBlock } from '../../KeysBlock';

describe('StorageLocationDetails', () => {
  const location: StorageLocation = {
    locationID: 'Location1',
    path: 'path',
    name: 'name',
    description: 'description',
    type: LocationType.CLIENT,
  };

  it('should have only a DescriptionBlock when not an S3 location', () => {
    const wrapper = shallow(<StorageLocationDetails location={location} />);

    expect(wrapper.find(dataTestId('storage-location-wrapper')).children()).toHaveLength(1);
    expect(wrapper.find(DescriptionBlock).prop('description')).toBe(location.description);
  });

  it('should have also a KeysBlock when an S3 location', () => {
    const s3Location: S3Location = {
      ...location,
      accessKey: 'access',
      secretKey: 'secret',
      bucketName: 'bucket',
    };
    const wrapper = shallow(<StorageLocationDetails location={s3Location} />);
    const keysBlock = wrapper.find(KeysBlock);

    expect(keysBlock.exists()).toBeTruthy();
    expect(keysBlock.prop('accessKey')).toBe(s3Location.accessKey);
    expect(keysBlock.prop('secretKey')).toBe(s3Location.secretKey);
  });
});
