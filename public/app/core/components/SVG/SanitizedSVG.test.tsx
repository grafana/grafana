import { svgStyleCleanup } from "./SanitizedSVG";
import { getSvgId, getSvgStyle } from "./utils";

const svgNoId = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">.st0{fill:purple;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>';
const svgWithId = '<svg id="TEST_ID" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">.st0{fill:blue;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>';
const svgWithWrongIdInStyle = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">#WRONG .st0{fill:green;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>';

describe('SanitizedSVG', () => {
  it('should cleanup the style and generate an ID', () => {
    const cleanStyle = svgStyleCleanup(svgNoId);
    const updatedStyle = getSvgStyle(cleanStyle);
    const svgId = getSvgId(cleanStyle);

    expect(cleanStyle.indexOf('id="')).toBeGreaterThan(-1);
    expect(svgId).toBeDefined();
    expect(svgId?.startsWith('x')).toBeTruthy();
    expect(updatedStyle?.indexOf(`#${svgId}`)).toBeGreaterThan(-1);

    expect(cleanStyle).toEqual(`<svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">#${svgId} .st0{fill:purple;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>`);
  });

  it('should cleanup the style and use the existing ID', () => {
    const cleanStyle = svgStyleCleanup(svgWithId);
    const updatedStyle = getSvgStyle(cleanStyle);
    const svgId = getSvgId(cleanStyle);

    expect(cleanStyle.indexOf('id="')).toBeGreaterThan(-1);
    expect(svgId).toBeDefined();
    expect(svgId).toEqual('TEST_ID');
    expect(updatedStyle?.indexOf(`#${svgId}`)).toBeGreaterThan(-1);

    expect(cleanStyle).toEqual(`<svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">#${svgId} .st0{fill:blue;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>`);
  });

  it('should cleanup the style and replace the wrong ID', () => {
    const cleanStyle = svgStyleCleanup(svgWithWrongIdInStyle);
    const updatedStyle = getSvgStyle(cleanStyle);
    const svgId = getSvgId(cleanStyle);

    expect(cleanStyle.indexOf('id="')).toBeGreaterThan(-1);
    expect(svgId).toBeDefined();
    expect(svgId?.startsWith('x')).toBeTruthy();
    expect(updatedStyle?.indexOf(`#${svgId}`)).toBeGreaterThan(-1);

    expect(cleanStyle).toEqual(`<svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style type="text/css">#${svgId} .st0{fill:green;}</style><circle cx="12" cy="12" r="10" class="st0"/></svg>`);
  });
});
