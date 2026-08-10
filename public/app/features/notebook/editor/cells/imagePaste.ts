const MAX_WIDTH = 1280;
// Data-URI markdown is stored inside the notebook spec; cap the embedded size so a
// screenshot cannot balloon the resource (~500KB decoded).
const MAX_ENCODED_CHARS = 700_000;

export type PastedImageResult = { ok: true; markdown: string } | { ok: false; reason: 'too-large' | 'unsupported' };

/**
 * Converts a pasted/dropped image file into an embeddable markdown image: downscaled
 * to a sane width, re-encoded as JPEG and inlined as a data URI (which the text-panel
 * sanitizer explicitly allows for img src).
 */
export async function imageFileToMarkdown(file: File): Promise<PastedImageResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: 'unsupported' };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }

  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    return { ok: false, reason: 'unsupported' };
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (dataUrl.length > MAX_ENCODED_CHARS) {
    return { ok: false, reason: 'too-large' };
  }

  // Brackets/parens in the alt text would break the markdown image syntax.
  const alt = (file.name || 'image').replace(/[[\]()]/g, '');
  return { ok: true, markdown: `![${alt}](${dataUrl})` };
}

/** The image file of a paste or drop event, if there is one. */
export function imageFileFromEvent(e: React.ClipboardEvent | React.DragEvent): File | undefined {
  const transfer = 'clipboardData' in e ? e.clipboardData : e.dataTransfer;
  if (!transfer) {
    return undefined;
  }
  for (const item of Array.from(transfer.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile() ?? undefined;
    }
  }
  return undefined;
}
