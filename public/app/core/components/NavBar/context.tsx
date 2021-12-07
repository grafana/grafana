import { createContext, HTMLAttributes, useContext } from 'react';

export interface NavBarItemMenuContextProps {
  menuHasFocus: boolean;
  onClose: () => void;
  menuProps?: HTMLAttributes<HTMLElement>;
}

export const NavBarItemMenuContext = createContext<NavBarItemMenuContextProps>({
  menuHasFocus: false,
  onClose: () => undefined,
});

export function useNavBarItemMenuContext(): NavBarItemMenuContextProps {
  return useContext(NavBarItemMenuContext);
}
