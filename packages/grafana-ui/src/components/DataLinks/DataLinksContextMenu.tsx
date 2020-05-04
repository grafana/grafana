import React, { useCallback, useMemo } from 'react';
import { WithContextMenu } from '../ContextMenu/WithContextMenu';
import { LinkModel } from '@grafana/data';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import { css } from 'emotion';

interface DataLinksContextMenuProps {
  children: (props: { openMenu?: React.MouseEventHandler<HTMLElement>; targetClassName?: string }) => JSX.Element;
  links?: () => LinkModel[];
}

export const DataLinksContextMenu: React.FC<DataLinksContextMenuProps> = ({ children, links }) => {
  if (!links) {
    return children({});
  }

  const items = useMemo(() => linkModelToContextMenuItems(links), [links]);
  const getDataLinksContextMenuItems = useCallback(() => [{ items, label: 'Data links' }], [items]);

  // Use this class name (exposed via render prop) to add context menu indicator to the click target of the visualization
  const targetClassName = useMemo(
    () =>
      items.length
        ? css`
            cursor: context-menu;
          `
        : '',
    [items]
  );

  return (
    <WithContextMenu getContextMenuItems={getDataLinksContextMenuItems}>
      {({ openMenu }) => {
        return children({ openMenu, targetClassName });
      }}
    </WithContextMenu>
  );
};
