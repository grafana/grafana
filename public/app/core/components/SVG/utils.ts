import { v4 as uuidv4 } from 'uuid';

export const getSvgStyle = (svgCode: string) => {
  const svgStyle = svgCode.match(new RegExp('<style type="text/css">([\\s\\S]*?)<\\/style>'));
  return svgStyle ? svgStyle[0] : null;
};

export const getSvgId = (svgCode: string) => {
  return svgCode.match(new RegExp('<svg.*id\\s*=\\s*([\'"])(.*?)\\1'))?.[2];
};

export const svgStyleCleanup = (svgCode: string) => {
  let svgId = getSvgId(svgCode);
  if (!svgId) {
    svgId = `x${uuidv4()}`;
    const pos = svgCode.indexOf('<svg') + 5;
    svgCode = svgCode.substring(0, pos) + `id="${svgId}" ` + svgCode.substring(pos);
  }

  let svgStyle = getSvgStyle(svgCode);
  if (svgStyle) {
    let replacedId = svgStyle.replace(/(#(.*?))?\./g, `#${svgId} .`);
    svgCode = svgCode.replace(svgStyle, replacedId);
  }

  return svgCode;
};
