// Dependencies may use Trusted Types sinks during module initialization.
import './trustedTypes';

declare let __webpack_public_path__: string;
declare let __webpack_nonce__: string;

// This is a path to the public folder without '/build-swagger'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build-swagger/')) ||
  __webpack_public_path__;

// The swagger bundle copies no images of its own, so assets read from the build directory
// (icons) come from the app build rather than from '/build-swagger'.
window.__grafana_build_path__ = `${window.__grafana_public_path__}build/`;

if (window.nonce) {
  __webpack_nonce__ = window.nonce;
}

import 'swagger-ui-react/swagger-ui.css';

import { createRoot } from 'react-dom/client';

import { ManifestsPage } from './ManifestsPage';
import { RouterStatusPage } from './RouterStatusPage';
import { Page } from './SwaggerPage';

window.onload = () => {
  // the trailing slash breaks relative URL loading
  if (window.location.pathname.endsWith('/')) {
    const idx = window.location.href.lastIndexOf('/');
    window.location.href = window.location.href.substring(0, idx);
    return;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    alert('unable to find root element');
    return;
  }
  const root = createRoot(rootElement);
  const router = new URLSearchParams(window.location.search).get('router');
  switch (router) {
    case '': {
      const url = new URL(window.location.href);
      url.searchParams.set('router', 'status');
      window.history.replaceState(null, '', url);
      root.render(<RouterStatusPage />);
      break;
    }
    case 'status':
      root.render(<RouterStatusPage />);
      break;
    case 'manifests':
      root.render(<ManifestsPage />);
      break;
    default:
      root.render(<Page />);
  }
};
