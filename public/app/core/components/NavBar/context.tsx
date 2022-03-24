import { createContext, HTMLAttributes, useContext } from 'react';

export interface NavBarItemMenuContextProps {
  menuHasFocus: boolean;
  onClose: () => void;
  onLeft: () => void;
  onTab: () => void;
  menuProps?: HTMLAttributes<HTMLElement>;
}

export const NavBarItemMenuContext = createContext<NavBarItemMenuContextProps>({
  menuHasFocus: false,
  onClose: () => undefined,
  onLeft: () => undefined,
  onTab: () => undefined,
});

export function useNavBarItemMenuContext(): NavBarItemMenuContextProps {
  return useContext(NavBarItemMenuContext);
}
