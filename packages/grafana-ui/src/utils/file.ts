/**
 * Shortens the filename to 16 length
 * @param fileName
 */
export function trimFileName(fileName: string): string {
  const nameLength = 16;
  const delimiter = fileName.lastIndexOf('.');
  const extension = fileName.slice(delimiter !== -1 ? delimiter : 0);
  const file = fileName.slice(0, delimiter !== -1 ? delimiter : 0);

  if (file.length < nameLength) {
    return fileName;
  }

  return `${file.slice(0, nameLength)}...${extension}`;
}
