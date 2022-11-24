import { FC } from 'react';
import ReactDOM from 'react-dom';

export interface RenderPortalProps {
  ID: string;
}

export declare type PortalEffectReturn = {
  portalDiv: HTMLElement | null;
}

export const getPortalContainer = (ID: string): HTMLElement | null => document.getElementById(ID);

export const RenderPortal: FC<RenderPortalProps> = ({ ID, children }) => {
  const portalDiv = getPortalContainer(ID)
  
  if(!portalDiv){
    return null;
  }

  return ReactDOM.createPortal(children, portalDiv);
};

