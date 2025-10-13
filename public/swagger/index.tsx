import '../app/core/trustedTypePolicies';
declare let __webpack_public_path__: string;
declare let __webpack_nonce__: string;

// Check if we are hosting files on cdn and set webpack public path
if (window.public_cdn_path) {
  __webpack_public_path__ = window.public_cdn_path;
}

// This is a path to the public folder without '/build'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

if (window.nonce) {
  __webpack_nonce__ = window.nonce;
}

import 'swagger-ui-react/swagger-ui.css';

import DOMPurify from 'dompurify';
import { createRoot } from 'react-dom/client';

import { textUtil } from '@grafana/data';

import { Page } from './SwaggerPage';

// Use dom purify for the default policy
const tt = window.trustedTypes;
if (tt?.createPolicy) {
  tt.createPolicy('default', {
    createHTML: (string, sink) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }) as unknown as string,
    createScriptURL: (url, sink) => textUtil.sanitizeUrl(url),
    createScript: (script, sink) => script,
  });
}

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
  root.render(<Page />);
};
