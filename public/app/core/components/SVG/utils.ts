export const getSvgStyle = (svgCode: string) => {
  const svgStyle = svgCode.match(new RegExp('<style type="text/css">([\\s\\S]*?)<\\/style>'));
  return svgStyle ? svgStyle[0] : null;
}

export const getSvgId = (svgCode: string) => {
  return svgCode.match(new RegExp('<svg.*id\\s*=\\s*([\'"])(.*?)\\1'))?.[2];
}
