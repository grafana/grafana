/**
 * This file is used to share internal grafana/i18n code with Grafana core.
 * Note that these exports are also used within Enterprise.
 *
 * Through the exports declared in package.json we can import this code in core Grafana and the grafana/i18n
 * package will continue to be able to access all code when it's published to npm as it's private to the package.
 *
 * During the yarn pack lifecycle the exports[./internal] property is deleted from the package.json
 * preventing the code from being importable by plugins or other npm packages making it truly "internal".
 *
 */

export {
  addResourceBundle,
  changeLanguage,
  getI18nInstance,
  getLanguage,
  getResolvedLanguage,
  initializeI18n,
  loadNamespacedResources,
} from '../i18n';
