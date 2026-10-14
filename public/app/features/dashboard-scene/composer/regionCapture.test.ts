import { cropToBlob, releaseCanvas, renderNode } from './raster';
import {
  getEffectiveBackground,
  MAX_IMAGE_EDGE,
  MAX_RASTER_PIXELS,
  planCrop,
  planPixelRatio,
  renderRegionImage,
} from './regionCapture';

jest.mock('./raster', () => ({
  renderNode: jest.fn(),
  cropToBlob: jest.fn(),
  releaseCanvas: jest.fn(),
}));

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

describe('renderRegionImage', () => {
  it('renders the root it is given, with the exclusion filter, and crops relative to it', async () => {
    const root = document.createElement('section');
    const excluded = document.createElement('aside');
    const kept = document.createElement('div');
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the box is read
      { left: 40, top: 60, width: 500, height: 400 } as DOMRect
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
    const raster = { width: 1000, height: 800 } as HTMLCanvasElement;
    const image = new Blob(['webp'], { type: 'image/webp' });
    jest.mocked(renderNode).mockResolvedValue(raster);
    jest.mocked(cropToBlob).mockResolvedValue(image);

    const result = await renderRegionImage({
      root,
      region: { left: 140, top: 110, width: 100, height: 50 },
      exclude: (node) => node === excluded,
      isCancelled: () => false,
    });

    expect(result.status === 'ready' && [result.image, result.width, result.height]).toEqual([image, 200, 100]);
    const [rendered, { filter }] = jest.mocked(renderNode).mock.calls[0];
    expect(rendered).toBe(root);
    expect(filter(excluded)).toBe(false);
    expect(filter(kept)).toBe(true);
    expect(cropToBlob).toHaveBeenCalledWith(
      raster,
      { sx: 200, sy: 100, sw: 200, sh: 100, width: 200, height: 100 },
      'image/webp',
      0.85
    );
    expect(releaseCanvas).toHaveBeenCalledWith(raster);
  });

  it("paints the page's background under a root that paints none of its own", async () => {
    const page = document.createElement('main');
    page.style.backgroundColor = 'rgb(9, 11, 15)';
    const root = document.createElement('section');
    page.appendChild(root);
    document.body.appendChild(page);
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the box is read
      { left: 0, top: 0, width: 100, height: 100 } as DOMRect
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
    jest.mocked(renderNode).mockResolvedValue({ width: 100, height: 100 } as HTMLCanvasElement);
    jest.mocked(cropToBlob).mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    try {
      await renderRegionImage({
        root,
        region: { left: 10, top: 10, width: 50, height: 50 },
        exclude: () => false,
        isCancelled: () => false,
      });

      expect(jest.mocked(renderNode).mock.calls.at(-1)?.[1].backgroundColor).toBe('rgb(9, 11, 15)');
    } finally {
      page.remove();
    }
  });
});

describe('getEffectiveBackground', () => {
  it('takes the first background an element or its ancestors paint', () => {
    const outer = document.createElement('div');
    outer.style.backgroundColor = 'rgb(0, 0, 0)';
    const middle = document.createElement('div');
    middle.style.backgroundColor = 'rgba(255, 255, 255, 0)';
    const inner = document.createElement('span');
    outer.appendChild(middle);
    middle.appendChild(inner);

    // Black is a colour, not transparency.
    expect(getEffectiveBackground(inner)).toBe('rgb(0, 0, 0)');
    middle.style.backgroundColor = 'rgb(9, 11, 15)';
    expect(getEffectiveBackground(inner)).toBe('rgb(9, 11, 15)');
  });

  it('is undefined when nothing paints one', () => {
    expect(getEffectiveBackground(document.createElement('div'))).toBeUndefined();
  });
});
