import React from 'react';

type PluginLogoProps = {
  src: string;
  className?: string;
};

export function PluginLogo({ src, className }: PluginLogoProps): React.ReactElement {
  return <img src={src} className={className} />;
}
