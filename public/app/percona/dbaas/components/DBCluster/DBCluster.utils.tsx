import React from 'react';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { Databases } from 'app/percona/shared/core';
import { DBCluster, DBClusterStatus, DBClusterStatusMap } from './DBCluster.types';
import { ADVANCED_SETTINGS_URL, SERVICE_MAP } from './DBCluster.constants';
import { DBClusterService } from './DBCluster.service';

export const isClusterChanging = ({ status }: DBCluster) => {
  const isChanging = status === DBClusterStatus.changing || status === DBClusterStatus.deleting;

  return isChanging;
};

export const getClusterStatus = (status: string | undefined, statusMap: DBClusterStatusMap): DBClusterStatus => {
  const key = Object.keys(statusMap).find((key: DBClusterStatus) => statusMap[key] === status) as DBClusterStatus;

  return key || DBClusterStatus.changing;
};

export const buildWarningMessage = (className: string) => (
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

export const newDBClusterService = (type: Databases): DBClusterService => {
  const service = SERVICE_MAP[type] as DBClusterService;

  return service || SERVICE_MAP[Databases.mysql];
};
