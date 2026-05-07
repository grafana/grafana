import { fieldColorModeRegistry } from '@grafana/data';

export function needsDynamicPalette(colorMode: string | undefined): boolean {
  if (!colorMode) {
    return false;
  }

  return fieldColorModeRegistry.getIfExists(colorMode) === undefined;
}
