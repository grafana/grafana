/**
 * Formats file size from byte
 * @param bytes The file size in bytes
 * @param decimals Default is 2
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Shortens the filename to 16 length
 * @param fileName
 */
export function trimFileName(fileName: string): string {
  const nameLength = 16;
  const delimiter = fileName.lastIndexOf('.');
  const extension = fileName.substring(delimiter);
  const file = fileName.substring(0, delimiter);

  if (file.length < nameLength) {
    return fileName;
  }

  return `${file.substring(0, nameLength)}...${extension}`;
}
