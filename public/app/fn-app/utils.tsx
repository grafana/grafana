import { FC, useEffect } from 'react';
import ReactDOM from 'react-dom';

export interface RenderPortalProps {
  renderContainer: HTMLElement;
}

export const RenderPortal: FC<RenderPortalProps> = ({ renderContainer, children }) => {
  useEffect(() => {
    const selector = $('#grafana-controls');
    const noOfChildren = selector.children().length;
    if (noOfChildren > 1) {
      selector.find('header:first').remove();
    }
  }, []);
  return ReactDOM.createPortal(children, renderContainer);
};
