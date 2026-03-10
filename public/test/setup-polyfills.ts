// This file must be listed FIRST in setupFiles.
// It sets critical globals before any other setup file's static imports
// can trigger @mswjs/interceptors to load (which requires TextEncoder to be a constructor).
import { TransformStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom may define these as non-writable; use Object.defineProperty to force override
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, writable: true, configurable: true });
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, writable: true, configurable: true });
Object.defineProperty(globalThis, 'TransformStream', { value: TransformStream, writable: true, configurable: true });

// Pre-load @mswjs/interceptors now that TextEncoder is set correctly.
// This primes the module cache so when test files import it transitively
// (via msw), they get this already-evaluated module rather than re-evaluating
// it in a context where TextEncoder might not be set.
await import('@mswjs/interceptors');
