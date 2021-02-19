import React from 'react';
import { WithContextMenu } from '../ContextMenu/WithContextMenu';
import { LinkModelSupplier } from '@grafana/data';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import { css } from 'emotion';

interface DataLinksContextMenuProps {
  children: (props: { openMenu?: React.MouseEventHandler<HTMLElement>; targetClassName?: string }) => JSX.Element;
  links?: LinkModelSupplier<any>;
}

export const DataLinksContextMenu: React.FC<DataLinksContextMenuProps> = ({ children, links }) => {
  if (!links) {
    return children({});
  }

  const getDataLinksContextMenuItems = () => {
    return [{ items: linkModelToContextMenuItems(links), label: 'Data links' }];
  };

  // Use this class name (exposed via render prop) to add context menu indicator to the click target of the visualization
  const targetClassName = css`
    cursor: context-menu;
  `;

  return (
    <WithContextMenu getContextMenuItems={getDataLinksContextMenuItems}>
      {({ openMenu }) => {
        return children({ openMenu, targetClassName });
      }}
    </WithContextMenu>
  );
};
