import { FALLBACK_COLOR } from '../types';
import { ThemeColors } from './createColors';

export interface ThemeVizColors {
  byName: (color: string) => string;
  byIndex: (index: number) => string;
  hues: ThemeVizHue[];
}

export interface ThemeVizColor {
  color: string;
  name: string;
  aliases?: string[];
  primary?: boolean;
}

export interface ThemeVizHue {
  name: string;
  shades: ThemeVizColor[];
}

export function createVizColors(colors: ThemeColors): ThemeVizColors {
  const hues: ThemeVizHue[] = [];
  const bySeriesIndex: string[] = [];

  if (colors.mode === 'dark') {
    hues.push({
      name: 'Red',
      shades: [
        { name: 'red1', color: '#FFC2D4', aliases: ['super-light-red'] },
        { name: 'red2', color: '#FFA8C2', aliases: ['light-red'] },
        { name: 'red3', color: '#FF85A9', aliases: ['red'] },
        { name: 'red4', color: '#FF5286', aliases: ['semi-dark-red'] },
        { name: 'red5', color: '#E0226E', aliases: ['dark-red'] },
      ],
    });

    hues.push({
      name: 'Orange',
      shades: [
        { name: 'orange1', color: '#FFC0AD', aliases: ['super-light-orange'] },
        { name: 'orange2', color: '#FFA98F', aliases: ['light-orange'] },
        { name: 'orange3', color: '#FF825C', aliases: ['orange'] },
        { name: 'orange4', color: '#FF5F2E', aliases: ['semi-dark-orange'] },
        { name: 'orange5', color: '#E73903', aliases: ['dark-orange'] },
      ],
    });

    hues.push({
      name: 'Yellow',
      shades: [
        { name: 'yellow1', color: '#FFE68F', aliases: ['super-light-yellow'] },
        { name: 'yellow2', color: '#FAD34A', aliases: ['light-yellow'] },
        { name: 'yellow3', color: '#ECBB09', aliases: ['yellow'] },
        { name: 'yellow4', color: '#CFA302', aliases: ['semi-dark-yellow'] },
        { name: 'yellow5', color: '#AD8800', aliases: ['dark-yellow'] },
      ],
    });

    hues.push({
      name: 'Green',
      shades: [
        { name: 'green1', color: '#93ECCB', aliases: ['super-light-green'] },
        { name: 'green2', color: '#65DCB1', aliases: ['light-green'] },
        { name: 'green3', color: '#2DC88F', aliases: ['green'] },
        { name: 'green4', color: '#25A777', aliases: ['semi-dark-green'] },
        { name: 'green5', color: '#1B855E', aliases: ['dark-green'] },
      ],
    });

    hues.push({
      name: 'Teal',
      shades: [
        { name: 'teal1', color: '#73E7F7' },
        { name: 'teal2', color: '#2BD6EE' },
        { name: 'teal3', color: '#11BDD4' },
        { name: 'teal4', color: '#0EA0B4' },
        { name: 'teal5', color: '#077D8D' },
      ],
    });

    hues.push({
      name: 'Blue',
      shades: [
        { name: 'blue1', color: '#C2D7FF', aliases: ['super-light-blue'] },
        { name: 'blue2', color: '#A3C2FF', aliases: ['light-blue'] },
        { name: 'blue3', color: '#83ACFC', aliases: ['blue'] },
        { name: 'blue4', color: '#5D8FEF', aliases: ['semi-dark-blue'] },
        { name: 'blue5', color: '#3871DC', aliases: ['dark-blue'] },
      ],
    });

    hues.push({
      name: 'Violet',
      shades: [
        { name: 'violet1', color: '#DACCFF' },
        { name: 'violet2', color: '#C7B2FF' },
        { name: 'violet3', color: '#B094FF' },
        { name: 'violet4', color: '#9271EF' },
        { name: 'violet5', color: '#7E63CA' },
      ],
    });

    hues.push({
      name: 'Purple',
      shades: [
        { name: 'purple1', color: '#DACCFF', aliases: ['super-light-purple'] },
        { name: 'purple2', color: '#C7B2FF', aliases: ['light-purple'] },
        { name: 'purple3', color: '#B094FF', aliases: ['purple'] },
        { name: 'purple4', color: '#9271EF', aliases: ['semi-dark-purple'] },
        { name: 'purple5', color: '#7E63CA', aliases: ['dark-purple'] },
      ],
    });

    bySeriesIndex.push(
      'green3',
      'yellow3',
      'blue3',
      'orange3',
      'red3',
      'blue5',
      'purple3',
      'violet3',
      'green5',
      'yellow5',
      'blue4'
    );
  }

  const byNameIndex: Record<string, string> = {};

  for (const hue of hues) {
    for (const shade of hue.shades) {
      byNameIndex[shade.name] = shade.color;
      if (shade.aliases) {
        for (const alias of shade.aliases) {
          byNameIndex[alias] = shade.color;
        }
      }
    }
  }

  // special colors
  byNameIndex['transparent'] = 'rgba(0,0,0,0)';
  byNameIndex['panel-bg'] = colors.background.primary;
  byNameIndex['text'] = colors.text.primary;

  const byName = (name: string) => {
    return byNameIndex[name] ?? FALLBACK_COLOR;
  };

  const byIndex = (index: number) => {
    return byName(bySeriesIndex[index % bySeriesIndex.length]);
  };

  return {
    hues,
    byName,
    byIndex,
  };
}
