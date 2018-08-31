import { NavModel } from './navModel';

export interface ContainerProps {
  navModel: NavModel;
  initNav: (...args: string[]) => void;
}
