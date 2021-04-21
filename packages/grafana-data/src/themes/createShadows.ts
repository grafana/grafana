import { ThemeColors } from './createColors';

/** @beta */
export interface ThemeShadows {
  z0: string;
  z1: string;
  z2: string;
  z3: string;
  z4: string;
}

function createDarkShadow(...px: number[]) {
  const shadowKeyUmbraOpacity = 0.2;
  const shadowKeyPenumbraOpacity = 0.15;
  const shadowAmbientShadowOpacity = 0.1;

  return [
    `${px[0]}px ${px[1]}px ${px[2]}px ${px[3]}px rgba(0,0,0,${shadowKeyUmbraOpacity})`,
    `${px[4]}px ${px[5]}px ${px[6]}px ${px[7]}px rgba(0,0,0,${shadowKeyPenumbraOpacity})`,
    `${px[8]}px ${px[9]}px ${px[10]}px ${px[11]}px rgba(0,0,0,${shadowAmbientShadowOpacity})`,
  ].join(',');
}

function createLightShadow(...px: number[]) {
  const shadowKeyUmbraOpacity = 0.15;
  const shadowKeyPenumbraOpacity = 0.1;
  const shadowAmbientShadowOpacity = 0.1;

  return [
    `${px[0]}px ${px[1]}px ${px[2]}px ${px[3]}px rgba(0,0,0,${shadowKeyUmbraOpacity})`,
    `${px[4]}px ${px[5]}px ${px[6]}px ${px[7]}px rgba(0,0,0,${shadowKeyPenumbraOpacity})`,
    `${px[8]}px ${px[9]}px ${px[10]}px ${px[11]}px rgba(0,0,0,${shadowAmbientShadowOpacity})`,
  ].join(',');
}

/** @alpha */
export function createShadows(colors: ThemeColors): ThemeShadows {
  if (colors.mode === 'dark') {
    return {
      z0: createDarkShadow(0, 1, 1, -1, 0, 1, 1, 0, 0, 1, 3, 0),
      z1: createDarkShadow(0, 1, 1, -1, 0, 1, 2, 0, 0, 1, 3, 0),
      z2: createDarkShadow(0, 3, 1, -2, 0, 2, 2, 0, 0, 1, 5, 0),
      z3: createDarkShadow(0, 2, 4, -1, 0, 4, 5, 0, 0, 1, 10, 0),
      z4: createDarkShadow(0, 5, 5, -3, 0, 8, 10, 1, 0, 3, 14, 2),
    };
  }

  return {
    z0: createLightShadow(0, 1, 1, -1, 0, 0, 0, 0, 0, 1, 3, 0),
    z1: createLightShadow(0, 1, 1, -1, 0, 1, 2, 0, 0, 1, 3, 0),
    z2: createLightShadow(0, 2, 1, -2, 0, 2, 2, 0, 0, 1, 5, 0),
    z3: createLightShadow(0, 2, 4, -1, 0, 4, 5, 0, 0, 1, 10, 0),
    z4: createLightShadow(0, 5, 5, -5, 0, 8, 10, 1, 0, 3, 14, 2),
  };
}
