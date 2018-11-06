import { PanelHeaderMenuItemProps, PanelHeaderMenuItemTypes } from 'app/types/panel';
import { PanelModel } from 'app/features/dashboard/panel_model';

export const getMenuAdditional = (panel: PanelModel) => {
  const getAdditionalMenuItems = () => {
    return [
      {
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Hello menu',
        handleClick: () => {
          alert('Hello world from menu');
        },
        shortcut: 'hi',
      },
    ] as PanelHeaderMenuItemProps[];
  };

  const getAdditionalSubMenuItems = () => {
    return [
      {
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Hello Sub Menu',
        handleClick: () => {
          alert('Hello world from sub menu');
        },
        shortcut: 'subhi',
      },
    ] as PanelHeaderMenuItemProps[];
  };

  return {
    additionalMenuItems: getAdditionalMenuItems(),
    additionalSubMenuItems: getAdditionalSubMenuItems(),
  };
};
