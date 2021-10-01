// Due to the grafana/ui Icon component making fetch requests to
// `/public/img/icon/<icon_name>.svg` we need to mock react-inlinesvg to prevent
// the failed fetch requests from displaying errors in console.

import React from 'react';

type Callback = (...args: any[]) => void;

export interface StorageItem {
  content: string;
  queue: Callback[];
  status: string;
}

export const cacheStore: { [key: string]: StorageItem } = Object.create(null);

const InlineSVG = ({ src }: { src: string }) => {
  return <svg xmlns="http://www.w3.org/2000/svg" data-testid={src} viewBox="0 0 24 24" />;
};

export default InlineSVG;
