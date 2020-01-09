import React, { FC } from 'react';

export interface BrandComponentProps {
  className: string;
}

export const LogoIcon: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

export const Wordmark: FC<BrandComponentProps> = ({ className }) => {
  return <div className={className} />;
};

export class Branding {
  static LogoIcon = LogoIcon;
  static Wordmark = Wordmark;
}
