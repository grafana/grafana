// https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic

// the previous heatmap panel used d3 deps and some code to interpolate to static 9-color palettes. here we just hard-code them for clarity.
// if the need arises for configurable-sized palettes, we can bring back the deps & variable interpolation (see simplified code at end)

export const palettes9 = {
  // Sequential (Single-Hue)
  Blues: ['#f7fbff', '#deebf7', '#c3dbee', '#9cc8e2', '#6daed5', '#4391c6', '#2271b4', '#0c5198', '#08306b'],
  Greens: ['#f7fcf5', '#e3f4de', '#c6e8bf', '#a0d89b', '#73c378', '#45aa5d', '#228b45', '#066b2d', '#00441b'],
  Greys: ['#ffffff', '#efefef', '#d8d8d8', '#bbbbbb', '#979797', '#737373', '#505050', '#262626', '#000000'],
  Purples: ['#fcfbfd', '#eeecf5', '#d9d8ea', '#bcbcdb', '#9e9bc9', '#817bb9', '#6a51a4', '#54288f', '#3f007d'],
  Reds: ['#fff5f0', '#feddcf', '#fcbaa1', '#fc9273', '#f9694c', '#eb3d2f', '#cb1c1e', '#a10e15', '#67000d'],
  Oranges: ['#fff5eb', '#fee5cc', '#fdcea0', '#fdae6c', '#fb8d3d', '#ef6a17', '#d54b04', '#a83703', '#7f2704'],

  // Sequential (Multi-Hue)
  BuGn: ['#f7fcfd', '#e4f5f7', '#c8eae4', '#99d8c8', '#68c2a3', '#42ac76', '#228c49', '#066b2d', '#00441b'],
  BuPu: ['#f7fcfd', '#deebf3', '#bfd3e6', '#a1bad9', '#8f95c6', '#8b6bb1', '#88409b', '#7a1579', '#4d004b'],
  GnBu: ['#f7fcf0', '#e1f3db', '#c9eac6', '#a7ddba', '#7bcbc4', '#50b1cd', '#2b8dbf', '#0e67a8', '#084081'],
  OrRd: ['#fff7ec', '#fee7c7', '#fdd3a1', '#fdb881', '#fa8e5d', '#ed6344', '#d53121', '#b00805', '#7f0000'],
  PuBuGn: ['#fff7fb', '#ebe3f0', '#ced1e6', '#a3bddb', '#69a8cf', '#3692ba', '#0b808b', '#01695b', '#014636'],
  PuBu: ['#fff7fb', '#ebe6f2', '#ced1e6', '#a5bddb', '#72a8cf', '#388fc0', '#0d72ad', '#04588a', '#023858'],
  PuRd: ['#f7f4f9', '#e7deed', '#d5bada', '#cf92c6', '#dd63ae', '#e22f88', '#c9135c', '#990340', '#67001f'],
  RdPu: ['#fff7f3', '#fddfdc', '#fcc3c3', '#fa9cb4', '#f369a3', '#da3495', '#ad0a81', '#7b0176', '#49006a'],
  YlGnBu: ['#ffffd9', '#eaf7b8', '#c1e7b5', '#81cebb', '#45b4c2', '#248fbd', '#2260a9', '#20378d', '#081d58'],
  YlGn: ['#ffffe5', '#f3fbbd', '#d7efa3', '#acdc8e', '#78c578', '#45a95d', '#228645', '#066737', '#004529'],
  YlOrBr: ['#ffffe5', '#fff5bc', '#fee18d', '#fec254', '#fb992c', '#ea7115', '#c94e05', '#993604', '#662506'],
  YlOrRd: ['#ffffcc', '#ffeda0', '#fed676', '#feb250', '#fd893c', '#f8502b', '#e11e20', '#b90424', '#800026'],
  Cividis: ['#002051', '#11366c', '#3c4d6e', '#62646f', '#7f7c75', '#9a9478', '#bbaf71', '#e2cb5c', '#fdea45'],
  CubehelixDefault: ['#000000', '#1b1d3b', '#16534c', '#437731', '#a07949', '#d483a7', '#c7b3ed', '#cae7f0', '#ffffff'],
  Warm: ['#6e40aa', '#a03db3', '#d23ea7', '#f9488a', '#ff5e63', '#ff7f41', '#efa72f', '#cdcf37', '#aff05b'],
  Cool: ['#6e40aa', '#5c5ace', '#417de0', '#27a3dc', '#1ac7c2', '#21e39b', '#40f373', '#73f65a', '#aff05b'],
  Turbo: ['#23171b', '#4569ee', '#26bce1', '#3ff393', '#95fb51', '#ecd12e', '#ff821d', '#cb2f0d', '#900c00'],
  Viridis: ['#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c', '#28ae80', '#5ec962', '#addc30', '#fde725'],
  Magma: ['#000004', '#1d1147', '#51127c', '#832681', '#b73779', '#e75263', '#fc8961', '#fec488', '#fcfdbf'],
  Inferno: ['#000004', '#210c4a', '#57106e', '#8a226a', '#bc3754', '#e45a31', '#f98e09', '#f9cb35', '#fcffa4'],
  Plasma: ['#0d0887', '#4c02a1', '#7e03a8', '#aa2395', '#cc4778', '#e66c5c', '#f89540', '#fdc527', '#f0f921'],

  // Diverging
  BrBG: ['#543005', '#985e15', '#cea156', '#efddb0', '#eef1ea', '#b3e1db', '#5bb2a8', '#12736a', '#003c30'],
  PRGn: ['#40004b', '#7d3d8c', '#ae8abd', '#dcc7e1', '#eff0ef', '#cbeac5', '#80c481', '#2d8643', '#00441b'],
  PiYG: ['#8e0152', '#c9378a', '#e795c3', '#f9d4e9', '#f5f3ef', '#d8efbb', '#9bce64', '#5a9c2b', '#276419'],
  PuOr: ['#2d004b', '#5f3d8f', '#998ebf', '#cecde4', '#f3eeea', '#fdd5a0', '#ee9d3d', '#be630b', '#7f3b08'],
  RdBu: ['#67001f', '#b82d35', '#e48268', '#faccb4', '#f2efee', '#bfdceb', '#6bacd0', '#2a71ae', '#053061'],
  RdGy: ['#67001f', '#b82d35', '#e48268', '#faccb5', '#faf4f1', '#d6d6d6', '#a0a0a0', '#5c5c5c', '#1a1a1a'],
  RdYlBu: ['#a50026', '#dd4030', '#f88d52', '#fed284', '#faf8c1', '#d1ebef', '#90c2dd', '#5382bb', '#313695'],
  RdYlGn: ['#a50026', '#dd4030', '#f88d52', '#fed281', '#f9f7ae', '#cbe984', '#85cb67', '#30a054', '#006837'],
  Spectral: ['#9e0142', '#db494a', '#f88e53', '#fed281', '#fbf8b0', '#d5ee9f', '#89cfa5', '#4696b3', '#5e4fa2'],

  // Cyclical
  Rainbow: ['#6e40aa', '#d23ea7', '#ff5e63', '#efa72f', '#aff05b', '#40f373', '#1ac7c2', '#417de0', '#6e40aa'],
  Sinebow: ['#ff4040', '#daa004', '#7fee11', '#25fb5f', '#00bfbf', '#255ffb', '#7f11ee', '#da04a0', '#ff4040'],
};

/*
// interpolation code, if/when needed:

<script src="https://cdn.jsdelivr.net/npm/d3-color@3"></script>
<script src="https://cdn.jsdelivr.net/npm/d3-interpolate@3"></script>
<script src="https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3"></script>

// from https://github.com/d3/d3-scale-chromatic/blob/main/src/index.js
// (or can enumerate all `d3.interpolate*` properties)
let names = [
  'BrBG','PRGn','PiYG','PuOr','RdBu','RdGy','RdYlBu','RdYlGn','Spectral','BuGn','BuPu','GnBu','OrRd',
  'PuBuGn','PuBu','PuRd','RdPu','YlGnBu','YlGn','YlOrBr','YlOrRd','Blues','Greens','Greys','Purples',
  'Reds','Oranges','Cividis','CubehelixDefault','Rainbow','Warm','Cool','Sinebow','Turbo','Viridis',
  'Magma','Inferno','Plasma'
];

let palettes: Record<string, string[]> = {};

function lerp(scheme: string, steps: number) {
  const interpolate = d3['interpolate' + scheme];

  let palette = [];

  steps--;

  for (let i = 0; i <= steps; i++) {
    let rgbStr = interpolate(i / steps);
    let rgb =
      rgbStr.indexOf('rgb') === 0
        ? '#' + [...rgbStr.matchAll(/\d+/g)].map((v) => (+v[0]).toString(16).padStart(2, '0')).join('')
        : rgbStr;
    palette.push(rgb);
  }

  return palette;
}

let steps = 9;
names.forEach((name) => {
  palettes[name] = lerp(name, steps);
});
*/
