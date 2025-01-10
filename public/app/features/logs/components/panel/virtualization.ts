
let ctx: CanvasRenderingContext2D | null = null;

export function init(fontFamily: string, fontSize: string) {
  const canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  if (!ctx) {
    return false;
  }
  ctx.font = `${fontSize} ${fontFamily}`;
  return true;
}

export function measureText(text: string, maxWidth: number, lineHeight: number) {
  if (!ctx) {
    throw new Error(`Measuring context canvas is not initialized. Call init() before.`);
  }
  
  let lines = 1;
  const textLines = text.split(`\n`);
  for (const textLine of textLines) {
    const chars = textLine.split('');
    
    let line = '';
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth) {
        lines+=1;
        line = chars[i];
      } else {
        line = testLine;
      }
    }
  }

  const height = lines * lineHeight;

  return {
    lines,
    height,
  };
}


