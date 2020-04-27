import { Pages } from './pages';
import { Components } from './components';
import { E2ESelectors } from '../types';

export const selectors: { pages: E2ESelectors<typeof Pages>; components: E2ESelectors<typeof Components> } = {
  pages: Pages,
  components: Components,
};
