// import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';

// const getUri = (url: string, size: number): Promise<string> => {
//   return fetch(url, { method: 'GET' })
//     .then((res) => {
//       return res.text();
//     })
//     .then((text) => {
//       const parser = new DOMParser();
//       const doc = parser.parseFromString(text, 'image/svg+xml');
//       const svg = doc.getElementsByTagName('svg')[0];
//       svg.setAttribute('width', size.toString());
//       svg.setAttribute('height', size.toString());
//       svg.setAttribute('fill', '#fff');
//       const svgString = new XMLSerializer().serializeToString(svg);
//       const urisvg = encodeURIComponent(svgString);
//       console.log('uri', `data:image/svg+xml${urisvg}`);
//       return `data:image/svg+xml${urisvg}`;
//     })
//     .catch((error) => {
//       console.error(error);
//       return '';
//     });
// };

// export const getSVGUri = async (url: string, size: number) => {
//   const svgUri = await getUri(url, size);

//   if (!svgUri) {
//     return getPublicOrAbsoluteUrl('img/icons/marker/circle.svg');
//   }
//   return svgUri;
// }
