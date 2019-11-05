import React, { FunctionComponent } from 'react';
import { cx } from 'emotion';
import { LoadingPlaceholder } from '@grafana/ui';

export const LoadingChunkPlaceHolder: FunctionComponent = React.memo(() => (
  <div className={cx('preloader')}>
    <LoadingPlaceholder text={'Loading...'} />
  </div>
));

LoadingChunkPlaceHolder.displayName = 'LoadingChunkPlaceHolder';
