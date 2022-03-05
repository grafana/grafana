import React, { FC } from 'react';

import { Messages } from '../../../DBaaS.messages';
import { ADVANCED_SETTINGS_URL } from '../../DBCluster/DBCluster.constants';

import { WarningMessageProps } from './WarningMessage.types';

export const WarningMessage: FC<WarningMessageProps> = ({ className }) => (
  <>
    {Messages.dbcluster.publicAddressWarningBegin}
    &nbsp;
    <a href={ADVANCED_SETTINGS_URL} className={className}>
      {Messages.dbcluster.publicAddressWarningLink}
    </a>
    &nbsp;
    {Messages.dbcluster.publicAddressWarningEnd}
  </>
);
