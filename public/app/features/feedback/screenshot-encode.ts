const base64FormatRegex = /^data:image\/([a-zA-Z0-9]+);base64,([A-Za-z0-9+/=]+)$/;

export function extractImageTypeAndData(encoded: string) {
  const matched = encoded.match(base64FormatRegex);

  if (!matched || matched.length !== 3) {
    return null;
  }

  return { type: matched[1], data: matched[2] };
}

export async function canvasToBase64String(canvas: HTMLCanvasElement): Promise<string | ArrayBuffer | null> {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve));
  const b64str = await blobToBase64(blob as Blob);
  return b64str;
}

function blobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    if (blob && blob instanceof Blob) {
      reader.readAsDataURL(blob);
    }
  });
}
