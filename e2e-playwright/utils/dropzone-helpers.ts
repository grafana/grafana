import { type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';

/** Test id on the root element every `FileDropzone` renders. */
export const DROPZONE_TEST_ID = 'dropzone';

/**
 * The hidden react-dropzone file input inside a `FileDropzone`, for `setInputFiles`.
 * Pass a narrower scope when the page renders more than one dropzone.
 */
export function dropzoneInput(scope: Page | Locator): Locator {
  return scope.getByTestId(DROPZONE_TEST_ID).locator('input[type="file"]');
}

/** Writes files into the test's output dir and returns their paths, for dragging onto a dropzone. */
export function writeFilesForDrag(testInfo: TestInfo, files: Array<{ name: string; contents: string }>): string[] {
  return files.map(({ name, contents }) => {
    const filePath = testInfo.outputPath(name);
    fs.writeFileSync(filePath, contents);
    return filePath;
  });
}

/**
 * Drags files onto a `FileDropzone`, the path `setInputFiles` never exercises.
 *
 * This goes through CDP rather than a hand-built `DataTransfer`: react-dropzone reads dropped
 * files through file-selector, which calls `getFile()` on the drag item's file-system handle, and
 * items added to a `new DataTransfer()` in page context carry no handle — the drop then throws
 * "Cannot read properties of undefined (reading 'getFile')" and the dropzone stays empty.
 * Chromium-only, which is the browser this suite runs in.
 */
export async function dragFilesOntoDropzone(page: Page, dropzone: Locator, filePaths: string[]) {
  const box = await dropzone.boundingBox();
  if (!box) {
    throw new Error('Cannot drag onto a dropzone that is not visible');
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const data = { items: [], files: filePaths, dragOperationsMask: 1 };

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
    await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
  } finally {
    await cdp.detach();
  }
}
