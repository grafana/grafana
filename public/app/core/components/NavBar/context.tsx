import { createContext, HTMLAttributes, useContext } from 'react';

export interface NavBarItemMenuContextProps {
  enableAllItems: boolean;
  onClose: () => void;
  menuProps?: HTMLAttributes<HTMLElement>;
}

export const NavBarItemMenuContext = createContext<NavBarItemMenuContextProps>({
  enableAllItems: false,
  onClose: () => undefined,
});

export function useNavBarItemMenuContext(): NavBarItemMenuContextProps {
  return useContext(NavBarItemMenuContext);
}
