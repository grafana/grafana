import DOMPurify from 'dompurify';

import { enforcingTrustedTypesPolicy } from 'app/core/trustedTypesPolicy';

const tt = window.trustedTypes;
if (tt?.createPolicy) {
  tt.createPolicy('default', {
    ...enforcingTrustedTypesPolicy,
    createHTML: (html) => DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: false }),
  });
}
