import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';

const getUri = (url: string, size: number): Promise<string> => {
  return fetch(url, { method: 'GET' })
    .then((res) => {
      return res.text();
    })
    .then((text) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.getElementsByTagName('svg')[0];
      if (!svg) {
        return '';
      }
      //set to white so ol color tint works
      svg.setAttribute('fill', '#fff');
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgURI = encodeURIComponent(svgString);
      return `data:image/svg+xml,${svgURI}`;
    })
    .catch((error) => {
      console.error(error);
      return '';
    });
};

export const getSVGUri = async (url: string, size: number) => {
  const svgURI = await getUri(url, size);

  if (!svgURI) {
    return getPublicOrAbsoluteUrl('img/icons/marker/circle.svg');
  }
  return svgURI;
};
