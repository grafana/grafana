import React, { FC } from 'react';
import { Icon } from '@grafana/ui';

export interface DashboardLink {
  url: string;
  title: string;
  icon: string;
  tooltip: string;
  target: string;
  keepTime?: boolean;
  includeVars?: boolean;
}

interface Props {
  linkInfo: any;
  link: DashboardLink;
}

export const DashboardLink: FC<Props> = ({ linkInfo, link }) => {
  console.log(link);
  return (
    <div className="gf-form">
      <a className="gf-form-label" href={linkInfo.href} target={link.target}>
        <Icon name={`${link.icon.replace(' ', '-')}`} />
        <span>{linkInfo.title}</span>
      </a>
    </div>
  );
};
