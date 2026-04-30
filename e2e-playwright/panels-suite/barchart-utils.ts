import { type Locator } from '@playwright/test';

export async function getUPlotCenterPosition(uplotLocator: Locator): Promise<{ x: number; y: number }> {
  const uOver = uplotLocator.locator('.u-over');
  const box = await uOver.boundingBox();
  if (!box) {
    throw new Error('u-over bounding box not found');
  }
  return { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
}
