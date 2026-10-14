import { MAX_IMAGE_EDGE, MAX_RASTER_PIXELS, planCrop, planPixelRatio } from './regionCapture';

describe('planPixelRatio', () => {
  it('renders at the device pixel ratio when the raster fits', () => {
    expect(planPixelRatio(1600, 2000, 1)).toBe(1);
    expect(planPixelRatio(1600, 2000, 2)).toBe(2);
  });

  it('lowers the ratio to stay within the raster budget', () => {
    const ratio = planPixelRatio(1600, 4000, 2)!;
    expect(ratio).toBeLessThan(2);
    expect(1600 * 4000 * ratio ** 2).toBeLessThanOrEqual(MAX_RASTER_PIXELS + 1);
  });

  it('refuses a dashboard that would need less than one raster pixel per CSS pixel', () => {
    expect(planPixelRatio(1600, 12000, 2)).toBeNull();
  });
});

describe('planCrop', () => {
  const node = { left: 0, top: -400, width: 1200, height: 3000 };
  const region = { left: 100, top: 100, width: 300, height: 200 };

  it('crops in CSS pixels at DPR 1', () => {
    expect(planCrop(node, region, { width: 1200, height: 3000 })).toEqual({
      sx: 100,
      sy: 500,
      sw: 300,
      sh: 200,
      width: 300,
      height: 200,
    });
  });

  it('scales the crop to the raster at DPR 2', () => {
    expect(planCrop(node, region, { width: 2400, height: 6000 })).toEqual({
      sx: 200,
      sy: 1000,
      sw: 600,
      sh: 400,
      width: 600,
      height: 400,
    });
  });

  it('uses the raster scale it got, not the one it asked for', () => {
    // Rendered below the device ratio to fit the budget: 1.5 raster pixels per CSS pixel.
    expect(planCrop(node, region, { width: 1800, height: 4500 })).toMatchObject({ sx: 150, sy: 750, sw: 450, sh: 300 });
  });

  it('downscales so the longest edge is at most 1568 pixels', () => {
    const plan = planCrop(node, { left: 0, top: -400, width: 1200, height: 1000 }, { width: 2400, height: 6000 });
    expect(plan).toMatchObject({ sw: 2400, sh: 2000, width: MAX_IMAGE_EDGE, height: Math.round(2000 * (1568 / 2400)) });
  });

  it('keeps the crop inside the raster', () => {
    const plan = planCrop(node, { left: 1100, top: 2500, width: 400, height: 400 }, { width: 1200, height: 3000 });
    expect(plan.sx + plan.sw).toBeLessThanOrEqual(1200);
    expect(plan.sy + plan.sh).toBeLessThanOrEqual(3000);
  });
});
