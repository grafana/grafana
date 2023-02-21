import React, { FC } from 'react';

import { ProgressModalHeaderProps } from '../../types';

import { Messages } from './ProgressModalHeader.messages';

export const ProgressModalHeader: FC<ProgressModalHeaderProps> = ({
  errorMessage = '',
  isUpdated = false,
  updateFailed = false,
}) => (
  <>
    {/* eslint-disable-next-line no-nested-ternary */}
    {isUpdated ? (
      <h4>{Messages.updateSucceeded}</h4>
    ) : !updateFailed ? (
      <h4>{Messages.updateInProgress}</h4>
    ) : (
      <>
        <h4>{Messages.updateFailed}</h4>
        <h4>{errorMessage}</h4>
      </>
    )}
  </>
);
