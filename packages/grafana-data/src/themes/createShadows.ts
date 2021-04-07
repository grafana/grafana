import { ThemePalette } from './createPalette';

export interface ThemeShadows {
  level1: string;
  level2: string;
  level3: string;
}

function createDarkShadow(...px: number[]) {
  const shadowKeyUmbraOpacity = 0.2;
  const shadowKeyPenumbraOpacity = 0.14;
  const shadowAmbientShadowOpacity = 0.12;

  return [
    `${px[0]}px ${px[1]}px ${px[2]}px ${px[3]}px rgba(0,0,0,${shadowKeyUmbraOpacity})`,
    `${px[4]}px ${px[5]}px ${px[6]}px ${px[7]}px rgba(0,0,0,${shadowKeyPenumbraOpacity})`,
    `${px[8]}px ${px[9]}px ${px[10]}px ${px[11]}px rgba(0,0,0,${shadowAmbientShadowOpacity})`,
  ].join(',');
}

function createLightShadow(...px: number[]) {
  const shadowKeyUmbraOpacity = 0.2;
  const shadowKeyPenumbraOpacity = 0.14;
  const shadowAmbientShadowOpacity = 0.12;

  return [
    `${px[0]}px ${px[1]}px ${px[2]}px ${px[3]}px rgba(0,0,0,${shadowKeyUmbraOpacity})`,
    `${px[4]}px ${px[5]}px ${px[6]}px ${px[7]}px rgba(0,0,0,${shadowKeyPenumbraOpacity})`,
    `${px[8]}px ${px[9]}px ${px[10]}px ${px[11]}px rgba(0,0,0,${shadowAmbientShadowOpacity})`,
  ].join(',');
}

export function createShadows(palette: ThemePalette): ThemeShadows {
  if (palette.mode === 'dark') {
    return {
      level1: createDarkShadow(0, 2, 1, -1, 0, 1, 1, 0, 0, 1, 3, 0),
      level2: createDarkShadow(0, 3, 1, -2, 0, 2, 2, 0, 0, 1, 5, 0),
      level3: createDarkShadow(0, 3, 3, -2, 0, 3, 4, 0, 0, 1, 8, 0),
    };
  }

  return {
    level1: createLightShadow(0, 2, 1, -1, 0, 1, 1, 0, 0, 1, 3, 0),
    level2: createLightShadow(0, 3, 1, -2, 0, 2, 2, 0, 0, 1, 5, 0),
    level3: createLightShadow(0, 3, 3, -2, 0, 3, 4, 0, 0, 1, 8, 0),
  };
}
