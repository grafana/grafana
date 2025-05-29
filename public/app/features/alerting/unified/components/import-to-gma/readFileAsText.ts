
/**
 * Helper function to read a File object as text using FileReader.
 * This can be more robust in certain scenarios compared to File.text(),
 * especially when dealing with files that might be externally modified.
 * @param file The File object to read.
 * @returns A Promise that resolves with the file's content as a string.
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error('Failed to read file as text.'));
      }
    };
    reader.onerror = (error) => {
      // Provide a more descriptive error message from FileReader
      reject(new Error(`Failed to read file: ${error?.target?.error?.name || 'Unknown error'}`));
    };
    reader.readAsText(file);
  });
}
