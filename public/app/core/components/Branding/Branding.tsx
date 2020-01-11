import React, { FC } from 'react';

export interface BrandComponentProps {
  className?: string;
}

export const LoginLogo: FC<BrandComponentProps> = ({ className }) => {
  return (
    <>
      <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />
      <div className="logo-wordmark" />
    </>
  );
};

export const MenuLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

export class Branding {
  static LoginLogo = LoginLogo;
  static MenuLogo = MenuLogo;
}
