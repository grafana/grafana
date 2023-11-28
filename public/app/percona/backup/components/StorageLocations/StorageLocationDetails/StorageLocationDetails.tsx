import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { BucketBlock } from '../../BucketBlock';
import { DescriptionBlock } from '../../DescriptionBlock';
import { KeysBlock } from '../../KeysBlock';
import { isS3Location } from '../StorageLocations.utils';

import { getStyles } from './StorageLocationDetails.styles';
import { StorageLocationDetailsProps } from './StorageLocationDetails.types';

export const StorageLocationDetails: FC<React.PropsWithChildren<StorageLocationDetailsProps>> = ({ location }) => {
  const { description } = location;
  const styles = useStyles(getStyles);

  return (
    <div data-testid="storage-location-wrapper" className={styles.wrapper}>
      <DescriptionBlock description={description} dataTestId="storage-location-description" />
      {isS3Location(location) ? (
        <>
          <BucketBlock bucketName={location.bucketName} />
          {/* eslint-disable-next-line jsx-a11y/no-access-key */}
          <KeysBlock accessKey={location.accessKey} secretKey={location.secretKey} />
        </>
      ) : null}
    </div>
  );
};
