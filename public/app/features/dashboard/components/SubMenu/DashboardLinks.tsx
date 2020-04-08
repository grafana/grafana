import React, { FC } from 'react';
import { DashboardModel } from '../../state';
import { DashboardLink } from '../DashLinks/DashboardLink';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';

export interface Props {
  dashboard: DashboardModel;
}

export const DashboardLinks: FC<Props> = ({ dashboard }) => {
  return dashboard.links.length > 0 ? (
    <>
      {dashboard.links.map((link: DashboardLink, index: number) => {
        const linkInfo = getLinkSrv().getAnchorInfo(link);
        return <DashboardLink key={`${link.title}-${index}`} linkInfo={linkInfo} link={link} />;
      })}
    </>
  ) : null;
};
