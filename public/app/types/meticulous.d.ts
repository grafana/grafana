import type { MeticulousPublicApi } from '@alwaysmeticulous/sdk-bundles-api';

declare global {
  interface Window {
    Meticulous?: MeticulousPublicApi;
  }
}
