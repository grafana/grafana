import React from 'react';

type PluginLogoProps = {
  alt: string;
  className?: string;
  src: string;
  height?: string | number;
};

export function PluginLogo({ alt, className, src, height }: PluginLogoProps): React.ReactElement {
  return <img src={src} className={className} alt={alt} loading="lazy" height={height} />;
}
