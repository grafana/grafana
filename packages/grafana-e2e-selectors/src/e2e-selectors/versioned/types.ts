import { versionedAPIs } from './apis';
import { versionedComponents } from './components';
import { versionedPages } from './pages';

export type VersionedSelectors = {
  pages: typeof versionedPages;
  components: typeof versionedComponents;
  apis: typeof versionedAPIs;
};
