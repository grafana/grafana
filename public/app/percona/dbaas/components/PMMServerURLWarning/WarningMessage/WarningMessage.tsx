import React, { FC } from 'react';
import { WarningMessageProps } from './WarningMessage.types';
import { Messages } from '../../../DBaaS.messages';
import { ADVANCED_SETTINGS_URL } from '../../DBCluster/DBCluster.constants';

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
