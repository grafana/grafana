import { NavModel } from './navModel';
import { initNav } from 'app/core/actions';

export interface ContainerProps {
  navModel: NavModel;
  initNav: typeof initNav;
}
