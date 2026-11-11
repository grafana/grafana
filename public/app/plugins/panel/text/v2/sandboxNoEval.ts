import * as z from 'zod';

// Even a caught eval capability probe generates a CSP violation in the protected document.
z.config({ jitless: true });
