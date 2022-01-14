import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from './BucketBlock.messages';
import { BucketBlockProps } from './BucketBlock.types';
import { getStyles } from './BucketBlock.styles';

export const BucketBlock: FC<BucketBlockProps> = ({ bucketName }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.wrapper} data-testid="storage-location-bucket">
      <span className={styles.nameSpan}>{Messages.bucketName}</span>
      <span>{bucketName}</span>
    </div>
  );
};
