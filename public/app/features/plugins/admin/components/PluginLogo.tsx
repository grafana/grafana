import React from 'react';

type PluginLogoProps = {
  alt: string;
  className?: string;
  src: string;
};

export function PluginLogo({ alt, className, src }: PluginLogoProps): React.ReactElement {
  // @ts-ignore
  return <img src={src} className={className} alt={alt} loading="lazy" />;
}
