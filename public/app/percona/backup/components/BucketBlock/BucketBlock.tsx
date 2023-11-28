import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { Messages } from './BucketBlock.messages';
import { getStyles } from './BucketBlock.styles';
import { BucketBlockProps } from './BucketBlock.types';

export const BucketBlock: FC<React.PropsWithChildren<BucketBlockProps>> = ({ bucketName }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.wrapper} data-testid="storage-location-bucket">
      <span className={styles.nameSpan}>{Messages.bucketName}</span>
      <span>{bucketName}</span>
    </div>
  );
};
