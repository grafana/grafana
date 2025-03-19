import { css } from '@emotion/react';

export interface Hacks {
  hackNoBackdropBlur?: boolean;
}

export function getHacksStyles(hacks: Hacks) {
  return css([
    /**
     * Disables all backdrop blur effects to improve performance on extremely
     * resource constrained devices.
     *
     * Controlled via the `noBackdropBlur` feature toggle in Grafana
     */
    hacks.hackNoBackdropBlur && {
      '*, *:before, *:after': {
        backdropFilter: 'none !important',
      },
    },
  ]);
}
