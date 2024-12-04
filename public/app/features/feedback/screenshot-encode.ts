export async function canvasToBase64String(canvas: HTMLCanvasElement): Promise<string | ArrayBuffer | null> {
  const blob = await new Promise(resolve => canvas.toBlob(resolve));
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
