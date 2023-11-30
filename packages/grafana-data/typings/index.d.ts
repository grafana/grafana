import { BootData } from '../../src';

declare global {
  interface Window {
    grafanaBootData?: BootData;
  }
}
